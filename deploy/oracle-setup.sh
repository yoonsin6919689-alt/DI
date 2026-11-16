#!/usr/bin/env bash
# One-shot setup for an Oracle Cloud Always Free VM running DIMENSION.
# Installs Docker, opens the ports Oracle blocks by default, and starts the site.
#
# Usage (on the VM, as a sudo-capable user):
#   sudo bash deploy/oracle-setup.sh
set -euo pipefail

HTTP_PORT="${HTTP_PORT:-80}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Checking that we are root"
if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash deploy/oracle-setup.sh" >&2
  exit 1
fi

log "Installing Docker"
if command -v docker >/dev/null 2>&1; then
  echo "docker already installed: $(docker --version)"
else
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y docker.io docker-compose-v2 ca-certificates curl git
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y dnf-utils
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
  else
    echo "Unsupported package manager. Install Docker manually." >&2
    exit 1
  fi
fi
systemctl enable --now docker

log "Opening ports $HTTP_PORT and 443 in the instance firewall"
# Oracle images ship an iptables ruleset that REJECTs everything except SSH.
# The VCN security list is a second, separate layer handled in the web console.
open_port() {
  local port="$1"
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="${port}/tcp" >/dev/null
  elif command -v iptables >/dev/null 2>&1; then
    # Insert before the catch-all REJECT rule rather than appending after it.
    iptables -C INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null \
      || iptables -I INPUT 6 -m state --state NEW -p tcp --dport "${port}" -j ACCEPT
  fi
}
open_port "$HTTP_PORT"
open_port 443
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --reload >/dev/null || true
fi
# Persist iptables rules so they survive reboot.
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save >/dev/null 2>&1 || true
elif [ -d /etc/sysconfig ]; then
  iptables-save > /etc/sysconfig/iptables 2>/dev/null || true
elif command -v service >/dev/null 2>&1; then
  service iptables save >/dev/null 2>&1 || true
fi

log "Done with system setup"
cat <<EOF

Next steps (run from the project directory on this VM):

  1. Create a .env with a fixed storage secret and your public address:
       printf 'STORAGE_SECRET=%s\nPUBLIC_ORIGIN=http://%s\nHOST_PORT=%s\n' \\
         "\$(openssl rand -hex 32)" "\$(curl -s ifconfig.me)" "$HTTP_PORT" > .env

  2. Build and start:
       docker compose up -d --build

  3. Check it responds:
       curl -s -o /dev/null -w '%{http_code}\n' http://localhost/functions/v1/app/api/health

IMPORTANT: also allow ingress for TCP $HTTP_PORT (and 443) in the Oracle web
console under Networking -> VCN -> Security Lists -> Add Ingress Rule.
Without that, the site stays unreachable from the internet even though the
instance firewall is open.
EOF
