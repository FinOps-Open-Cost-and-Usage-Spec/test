// api/webhook.js
export default async function handler(req, res) {
  // 1. Verify this is a Project Item event
  const { action, projects_v2_item } = req.body;

  if (action === 'edited' && projects_v2_item) {
    const owner = 'YOUR_GITHUB_USERNAME_OR_ORG';
    const repo = 'YOUR_REPO_NAME';

    // 2. Fire the Repository Dispatch
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'project_field_updated',
        client_payload: {
          item_node_id: projects_v2_item.node_id,
          project_node_id: projects_v2_item.project_node_id,
        }
      })
    });

    if (response.ok) {
      return res.status(200).send('Dispatch sent!');
    } else {
      const error = await response.text();
      return res.status(500).send(`GitHub API Error: ${error}`);
    }
  }

  res.status(200).send('Ignored: Not a project item edit.');
}
