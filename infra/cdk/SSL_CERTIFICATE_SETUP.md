# SSL Certificate and Custom Domain Setup Guide

This guide explains how to set up SSL certificates and custom domain for the v1z3r application.

## Prerequisites

1. Domain name registered (e.g., `v1z3r.sc4pe.net`)
2. Access to domain's DNS management
3. AWS account with permissions for Route 53 and ACM

## Step 1: Create Hosted Zone in Route 53

```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name v1z3r.sc4pe.net \
  --caller-reference $(date +%s) \
  --profile prod

# Note the hosted zone ID and name servers
```

## Step 2: Update Domain Name Servers

1. Log in to your domain registrar
2. Update name servers to the ones provided by Route 53:
   - ns-XXX.awsdns-XX.com
   - ns-XXX.awsdns-XX.net
   - ns-XXX.awsdns-XX.org
   - ns-XXX.awsdns-XX.co.uk

## Step 3: Request SSL Certificate

### Option A: Using AWS Console

1. Go to AWS Certificate Manager (ACM) in **us-east-1** region (required for CloudFront)
2. Click "Request a certificate"
3. Choose "Request a public certificate"
4. Add domain names:
   - `v1z3r.sc4pe.net`
   - `*.v1z3r.sc4pe.net`
5. Choose DNS validation
6. Review and request

### Option B: Using AWS CLI

```bash
# Request certificate in us-east-1 (required for CloudFront)
aws acm request-certificate \
  --domain-name v1z3r.sc4pe.net \
  --subject-alternative-names "*.v1z3r.sc4pe.net" \
  --validation-method DNS \
  --region us-east-1 \
  --profile prod

# Note the certificate ARN
```

## Step 4: Validate Certificate

1. In ACM console, click on the certificate
2. For each domain, create the CNAME records in Route 53:
   ```bash
   # Example validation record
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z1234567890ABC \
     --change-batch '{
       "Changes": [{
         "Action": "CREATE",
         "ResourceRecordSet": {
           "Name": "_1234567890.v1z3r.sc4pe.net",
           "Type": "CNAME",
           "TTL": 300,
           "ResourceRecords": [{
             "Value": "_abcdefghij.acm-validations.aws."
           }]
         }
       }]
     }' \
     --profile prod
   ```

3. Wait for validation (usually takes 5-30 minutes)

## Step 5: Update CDK Stack

1. Uncomment the SSL certificate code in `vj-unified-stack.ts`:

```typescript
// SSL Certificate
if (enableCloudFront && stage === 'prod') {
  this.certificate = new acm.Certificate(this, 'SslCertificate', {
    domainName: 'v1z3r.sc4pe.net',
    subjectAlternativeNames: ['*.v1z3r.sc4pe.net'],
    validation: acm.CertificateValidation.fromDns(),
  });
}

// CloudFront Distribution
this.distribution = new cloudfront.Distribution(this, 'Distribution', {
  // ... existing config ...
  domainNames: enableCloudFront && stage === 'prod' ? ['v1z3r.sc4pe.net'] : undefined,
  certificate: this.certificate,
  // ... rest of config ...
});
```

2. Deploy the updated stack:
```bash
cd /home/ec2-user/workspace/v1z3r/infra/cdk
npx cdk deploy VjUnifiedStack-prod --profile prod
```

## Step 6: Create Route 53 Records

```bash
# Create A record for CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "v1z3r.sc4pe.net",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d123456789.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }' \
  --profile prod
```

## Step 7: Test the Setup

```bash
# Test HTTPS
curl -I https://v1z3r.sc4pe.net

# Test SSL certificate
openssl s_client -connect v1z3r.sc4pe.net:443 -servername v1z3r.sc4pe.net

# DNS lookup
nslookup v1z3r.sc4pe.net
dig v1z3r.sc4pe.net
```

## Troubleshooting

### Certificate Validation Fails
- Ensure CNAME records are created correctly
- Check DNS propagation: `dig _1234567890.v1z3r.sc4pe.net CNAME`
- Wait up to 72 hours for DNS propagation

### CloudFront Distribution Error
- Certificate must be in us-east-1 region
- Domain names in certificate must match CloudFront domain names
- Certificate must be validated before use

### DNS Not Resolving
- Check Route 53 hosted zone name servers
- Verify domain registrar points to Route 53 name servers
- Use `dig +trace v1z3r.sc4pe.net` to debug DNS resolution

## Security Best Practices

1. Use DNS validation instead of email validation
2. Include both apex domain and wildcard in certificate
3. Enable automatic certificate renewal
4. Monitor certificate expiration with CloudWatch
5. Use separate certificates for different environments

## Cost Considerations

- Route 53 Hosted Zone: ~$0.50/month
- ACM Certificates: Free for AWS resources
- DNS queries: ~$0.40 per million queries
- CloudFront custom domain: No additional cost

## Next Steps

After SSL setup is complete:
1. Update application configuration with HTTPS URLs
2. Implement HTTP to HTTPS redirects
3. Update CORS settings for HTTPS origins
4. Test WebSocket connections over WSS
5. Monitor SSL certificate expiration