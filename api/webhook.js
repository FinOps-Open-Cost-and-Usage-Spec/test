import crypto from 'crypto';

export default async function handler(req, res) {
  // 1. Signature Verification
  const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    return res.status(401).send('Unauthorized: Signature mismatch');
  }

  // 2. Extract Data
  const { action, projects_v2_item, changes } = req.body;

  if (action === 'edited' && projects_v2_item) {
    const owner = 'FinOps-Open-Cost-and-Usage-Spec';
    const repo = 'test';

    // 3. Dispatch to GitHub Actions
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Webhook-Glue'
      },
      body: JSON.stringify({
        event_type: 'project_field_updated',
        client_payload: {
          item_node_id: projects_v2_item.node_id,
          project_node_id: projects_v2_item.project_node_id,
          content_node_id: projects_v2_item.content_node_id,
          old_value: changes?.field_value?.from || "Unknown",
          field_name: changes?.field_value?.field_name || "Unknown"
        }
      })
    });

    if (response.ok) {
      return res.status(200).send('Success');
    }
    return res.status(500).send(await response.text());
  }

  res.status(200).send('No action taken');
}
