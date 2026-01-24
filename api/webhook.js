import crypto from 'crypto';

export default async function handler(req, res) {
  // 1. Security Verification
  const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    return res.status(401).send('Signature mismatch.');
  }

  // 2. Extract Data
  const { action, projects_v2_item, changes, sender } = req.body;

  const contentNodeId = projects_v2_item.content_node_id || projects_v2_item.content?.node_id || null;

  if (action !== 'edited' || !contentNodeId) {
    return res.status(200).send('Action ignored.');
  }

  // 3. Extract the User who made the change
  const userWhoChanged = sender?.login || "Unknown User";

  // 4. Handle Old Value Logic
  let oldValue = "None";
  const rawFrom = changes?.field_value?.from;
  if (rawFrom !== undefined && rawFrom !== null) {
    if (typeof rawFrom === 'object') {
      oldValue = rawFrom.name || rawFrom.text || "None";
    } else {
      oldValue = String(rawFrom).split('T')[0];
    }
  }

  const fieldName = changes?.field_value?.field_name || "Unknown Field";

  // 5. Dispatch
  try {
    await fetch(`https://api.github.com/repos/FinOps-Open-Cost-and-Usage-Spec/test/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Webhook'
      },
      body: JSON.stringify({
        event_type: 'project_field_updated',
        client_payload: {
          item_node_id: projects_v2_item.node_id,
          content_node_id: projects_v2_item.content_node_id || projects_v2_item.content?.node_id || null,
          field_name: fieldName,
          old_value: oldValue,
          changed_by: userWhoChanged // New field
        }
      })
    });
    return res.status(200).send('Dispatched.');
  } catch (error) {
    return res.status(500).send('Error.');
  }
}
