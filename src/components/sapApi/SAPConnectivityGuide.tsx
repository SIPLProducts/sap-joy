import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SAPConnectivityGuide() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SAP Connectivity Guide</CardTitle>
          <CardDescription>How to connect your on-premise or cloud SAP system to MRB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Connection Modes</h3>
            
            <div className="grid gap-4">
              {[
                {
                  mode: 'Direct (Cloud SAP)',
                  badge: 'Recommended for Cloud',
                  desc: 'Connect directly to SAP S/4HANA Cloud or SAP BTP. No middleware needed.',
                  steps: ['Get API endpoint from SAP BTP cockpit', 'Configure Basic Auth or OAuth credentials', 'Test connection'],
                },
                {
                  mode: 'Via VPN Tunnel (ngrok)',
                  badge: 'For On-Premise',
                  desc: 'Use ngrok or Cloudflare Tunnel to expose on-premise SAP through a secure tunnel. Ideal for development and small deployments.',
                  steps: [
                    'Install ngrok: npm install -g ngrok',
                    'Set up Node.js proxy server on your local machine',
                    'Connect to customer VPN',
                    'Run: ngrok http 3001',
                    'Copy the tunnel URL and paste in API configuration',
                  ],
                },
                {
                  mode: 'Via Proxy Server',
                  badge: 'Enterprise',
                  desc: 'Route through a dedicated proxy server deployed in the customer network. Best for production.',
                  steps: ['Deploy proxy server in DMZ', 'Configure firewall rules', 'Set proxy URL in API configuration'],
                },
              ].map((item) => (
                <Card key={item.mode} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{item.mode}</h4>
                      <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{item.desc}</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {item.steps.map((step, i) => (
                        <li key={i} className="text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">ngrok Quick Start</h3>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="bg-background rounded-lg p-4 font-mono text-sm space-y-2">
                  <p className="text-muted-foreground"># 1. Install the proxy server</p>
                  <p>npm install express http-proxy-middleware cors</p>
                  <p className="text-muted-foreground mt-3"># 2. Create index.js proxy</p>
                  <p className="text-xs break-all">const express = require('express'); const {'{'} createProxyMiddleware {'}'} = require('http-proxy-middleware');</p>
                  <p className="text-muted-foreground mt-3"># 3. Start the proxy</p>
                  <p>node index.js</p>
                  <p className="text-muted-foreground mt-3"># 4. Start ngrok tunnel</p>
                  <p>ngrok http 3001</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Free ngrok URLs change on restart. For permanent URLs, use ngrok paid plan or Cloudflare Tunnel.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Self-Signed SAP Certificate</h3>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  On-premise SAP systems often use a self-signed HTTPS certificate. Node.js rejects these
                  by default. If you see <code>self-signed certificate</code> or
                  <code> DEPTH_ZERO_SELF_SIGNED_CERT</code> in the test result, configure the middleware
                  to skip cert validation for SAP.
                </p>
                <div className="bg-background rounded-lg p-4 font-mono text-xs space-y-2">
                  <p className="text-muted-foreground"># Option 1: axios — add an https agent</p>
                  <p>const https = require('https');</p>
                  <p>const sapAgent = new https.Agent({'{ rejectUnauthorized: false }'});</p>
                  <p>axios({'{ method, url, data, headers, httpsAgent: sapAgent, timeout: 60000 }'});</p>
                  <p className="text-muted-foreground mt-3"># Option 2: node-fetch v2</p>
                  <p>fetch(url, {'{ agent: sapAgent, ... }'});</p>
                  <p className="text-muted-foreground mt-3"># Option 3 (dev only): start middleware with env flag</p>
                  <p>NODE_TLS_REJECT_UNAUTHORIZED=0 node index.js</p>
                  <p className="text-muted-foreground mt-3"># Then restart PM2</p>
                  <p>pm2 restart mrb-app</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is standard for internal SAP behind a corporate network. For production, install
                  the SAP cert into Node's trust store instead of disabling validation globally.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
