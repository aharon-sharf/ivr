# Asterisk Telephony System - Ansible Playbooks

This directory contains Ansible playbooks for installing and configuring Asterisk on EC2 for the Mass Voice Campaign System.

## Prerequisites

1. **Ansible installed** on your local machine:
   ```bash
   pip install ansible
   ```

2. **EC2 instance provisioned** via Terraform (Task 7.1)

3. **SSH access** to the EC2 instance with your private key

4. **Environment variables** set for sensitive credentials:
   ```bash
   export SIP_TRUNK_USERNAME="your-sip-username"
   export SIP_TRUNK_PASSWORD="your-sip-password"
   export AMI_PASSWORD="your-ami-password"
   export ARI_PASSWORD="your-ari-password"
   export S3_AUDIO_BUCKET="your-audio-bucket-name"
   ```

## Quick Start

### 1. Update Inventory

Edit `inventory/hosts.ini` and add your Asterisk EC2 instance:

```ini
[asterisk]
asterisk-server ansible_host=YOUR_EC2_PUBLIC_IP ansible_user=ec2-user ansible_ssh_private_key_file=~/.ssh/your-key.pem
```

### 2. Test Connection

```bash
ansible -i inventory/hosts.ini asterisk -m ping
```

### 3. Run Complete Setup

```bash
ansible-playbook -i inventory/hosts.ini site.yml
```

This will:
- Install Asterisk from source
- Configure SIP trunk for Israeli provider (019/Partner)
- Set up AMI (Asterisk Manager Interface)
- Set up ARI (Asterisk REST Interface)
- Configure IVR dialplan
- Deploy Node.js worker
- Configure systemd services

## Individual Playbooks

You can run individual playbooks for specific tasks:

### Install Asterisk Only
```bash
ansible-playbook -i inventory/hosts.ini asterisk-setup.yml
```

### Configure Asterisk Only
```bash
ansible-playbook -i inventory/hosts.ini asterisk-configure.yml
```

### Deploy Node.js Worker Only
```bash
ansible-playbook -i inventory/hosts.ini nodejs-worker-deploy.yml
```

## Configuration

### SIP Trunk Configuration

Edit `group_vars/asterisk.yml` to configure your Israeli SIP trunk provider:

```yaml
sip_trunk_provider: "019"  # or "Partner"
sip_trunk_host: "sip.019.co.il"
sip_trunk_username: "{{ lookup('env', 'SIP_TRUNK_USERNAME') }}"
sip_trunk_password: "{{ lookup('env', 'SIP_TRUNK_PASSWORD') }}"
```

### AMI/ARI Credentials

Set strong passwords for AMI and ARI:

```yaml
ami_username: "admin"
ami_password: "{{ lookup('env', 'AMI_PASSWORD') }}"
ari_username: "asterisk"
ari_password: "{{ lookup('env', 'ARI_PASSWORD') }}"
```

## Verification

### Check Asterisk Status
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "asterisk -rx 'core show version'" -b
```

### Check PJSIP Endpoints
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "asterisk -rx 'pjsip show endpoints'" -b
```

### Check AMI Status
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "asterisk -rx 'manager show settings'" -b
```

### Check Node.js Worker
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "systemctl status asterisk-worker" -b
```

### Test Health Endpoint
```bash
ansible -i inventory/hosts.ini asterisk -m uri -a "url=http://localhost:3000/health"
```

## Dialplan Overview

The IVR dialplan includes:

- **Main IVR Menu**: Plays audio message and waits for DTMF input
- **DTMF Actions**:
  - Press 1: Donation/transfer action
  - Press 2: More information
  - Press 9: Opt-out (add to blacklist)
- **Timeout Handler**: Handles no input scenario
- **Outbound Context**: For originating campaign calls

## Troubleshooting

### View Asterisk Logs
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "tail -f /var/log/asterisk/full" -b
```

### View Node.js Worker Logs
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "journalctl -u asterisk-worker -f" -b
```

### Restart Services
```bash
# Restart Asterisk
ansible -i inventory/hosts.ini asterisk -m systemd -a "name=asterisk state=restarted" -b

# Restart Node.js Worker
ansible -i inventory/hosts.ini asterisk -m systemd -a "name=asterisk-worker state=restarted" -b
```

### Test SIP Trunk Registration
```bash
ansible -i inventory/hosts.ini asterisk -m shell -a "asterisk -rx 'pjsip show registrations'" -b
```

## Security Notes

1. **Firewall**: Ensure security groups allow:
   - SSH (22) from your IP
   - SIP (5060/5061) from SIP trunk provider
   - RTP (10000-20000) from anywhere
   - AMI (5038) from VPC only
   - Node.js Worker (3000) from VPC only

2. **Credentials**: Never commit credentials to git. Always use environment variables or Ansible Vault.

3. **AMI/ARI Access**: Restricted to VPC CIDR ranges in the configuration.

## Next Steps

After successful setup:

1. Upload audio files to S3 bucket
2. Test outbound call origination
3. Integrate with Lambda functions
4. Configure CloudWatch logging
5. Set up monitoring and alerts

## Support

For issues or questions, refer to:
- Asterisk documentation: https://wiki.asterisk.org
- PJSIP configuration: https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip
- ARI documentation: https://wiki.asterisk.org/wiki/display/AST/Asterisk+REST+Interface
