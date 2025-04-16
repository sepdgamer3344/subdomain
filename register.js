export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  
    const { username, email, serverIp } = req.body;
    const errors = [];
  
    // Validation
    if (!username || !username.match(/^[a-zA-Z0-9-]{3,20}$/)) {
      errors.push('Username must be 3-20 characters (letters, numbers, hyphens only).');
    }
  
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push('Please enter a valid email address.');
    }
  
    if (!serverIp) {
      errors.push('Server IP address is required.');
    }
  
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
  
    try {
      // Send to Discord webhook
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'New Subdomain Request',
          embeds: [{
            title: 'Registration Details',
            color: 5763719,
            fields: [
              { name: 'Subdomain', value: `${username}.minecraft-sub.com`, inline: true },
              { name: 'Email', value: email, inline: true },
              { name: 'Server IP', value: serverIp, inline: true },
              { name: 'Status', value: 'Pending setup', inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        })
      });
  
      if (!response.ok) throw new Error('Discord webhook failed');
  
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ errors: ['An error occurred during registration.'] });
    }
  }