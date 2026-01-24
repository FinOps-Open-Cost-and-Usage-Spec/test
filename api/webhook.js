import crypto from 'crypto';

export default async function handler(req, res) {
  // 1. Security: Verify the GitHub Webhook Secret
  const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    return res.status(401).send('No signature provided.');
  }

  const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    return res.status(401).send('Signature mismatch.');
  }

  // 2. Extract Data
  const { action, projects_v2_item, changes } = req.body;

  // 3. Early Exit if not an 'edited' event or missing content
  // We check for the flat 'content_node_id' which you confirmed is present
  const contentNodeId = projects_v2_item?.content_node_id || projects_v2_item?.content?.node_id;

  if (action !== 'edited' || !contentNodeId) {
    return res.status(200).send('Action ignored: Not an edit or missing content ID.');
  }

  // 4. Handle "Status" vs Custom Fields for the 'Old Value'
  // GitHub sends an object for Select fields (Status) but a string for others.
  let oldValue = "None";
  const rawFrom = changes?.field_value?.from;

  if (rawFrom !== undefined && rawFrom !== null) {
    if (typeof rawFrom === 'object') {
      // It's a Status/Select field
      oldValue = rawFrom.name || rawFrom.text || "None";
    } else {
      // It's a Date or Text field string - Apply the single-line date trim
      oldValue = String(rawFrom).split('T')[0];
    }
  }

  const fieldName = changes?.field_value?.field_name || "Unknown Field";

  // 5. Dispatch to GitHub Actions
  try {
    const owner = 'FinOps-Open-Cost-and-Usage-Spec'; // Update if needed
    const repo = 'test'; // Update if needed

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Webhook-Helper'
      },
      body: JSON.stringify({
        event_type: 'project_field_updated',
        client_payload: {
          item_node_id: projects_v2_item.node_id,
          project_node_id: projects_v2_item.project_node_id,
          content_node_id: projects_v2_item.content_node_id || projects_v2_item.content?.node_id || null,
          field_name: fieldName,
          old_value: oldValue // Sent as a clean string
        }
      })
    });

    if (response.ok) {
      return res.status(200).send('Successfully dispatched to GitHub Actions.');
    } else {
      const errorText = await response.text();
      console.error("GitHub API Error:", errorText);
      return res.status(500).send(`GitHub Dispatch Failed: ${errorText}`);
    }
  } catch (error) {
    console.error("Internal Server Error:", error);
    return res.status(500).send('Internal Server Error');
  }
}
