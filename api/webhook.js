export default async function handler(req, res) {
  // 1. Verify this is a Project Item event
  const { action, projects_v2_item, changes } = req.body;

  // Use optional chaining to prevent crashes on Draft Issues
  const contentNodeId = projects_v2_item?.content?.node_id;

  if (action === 'edited' && projects_v2_item) {
    const owner = 'FinOps-Open-Cost-and-Usage-Spec';
    const repo = 'test';

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Webhook-Glue' // CRITICAL: GitHub requires this
      },
      body: JSON.stringify({
        event_type: 'project_field_updated',
        client_payload: {
          item_node_id: projects_v2_item.node_id,
          project_node_id: projects_v2_item.project_node_id,
          content_node_id: contentNodeId || null, 
          old_value: changes?.field_value?.from || "Unknown",
          field_name: changes?.field_value?.field_name || "Unknown"
        }
      })
    });

    if (response.ok) {
      return res.status(200).send('Dispatch sent!');
    } else {
      const errorText = await response.text();
      console.error('GitHub API Error:', errorText);
      return res.status(500).send(`GitHub API Error: ${errorText}`);
    }
  }

  res.status(200).send('Ignored: Not a project item edit.');
}
