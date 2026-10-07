#!/bin/bash
# เตรียม droplet (Ubuntu 24.04) รอบเดียวสำหรับทั้ง live + dev — idempotent รันซ้ำได้
# วิธีใช้ (จากเครื่องคุณ ใน repo):
#   scp deploy/setup-server.sh root@<droplet-ip>:/root/
#   ssh root@<droplet-ip> "bash /root/setup-server.sh"
set -euo pipefail

echo "==> [1/6] อัปเดตแพ็กเกจ"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> [2/6] ติดตั้ง Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
else
  echo "    มี docker อยู่แล้ว: $(docker --version)"
fi

echo "==> [3/6] เปิด swap 2G"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
else
  echo "    มี swap อยู่แล้ว"
fi

echo "==> [4/6] ตั้ง firewall (เปิดเฉพาะ SSH/80/443)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# rule LIMIT 22 (มากับบาง image) ทำ CI ที่ต่อ SSH ถี่ ๆ โดน drop — ลบทิ้ง
ufw delete limit 22/tcp 2>/dev/null || true
# พอร์ต Docker API ห้ามเปิดออกเน็ตเด็ดขาด
ufw delete allow 2375/tcp 2>/dev/null || true
ufw delete allow 2376/tcp 2>/dev/null || true
ufw --force enable

echo "==> [5/6] สร้างโฟลเดอร์ live/dev"
mkdir -p /opt/blulens /opt/blulens-dev

echo "==> [6/6] สร้าง docker network กลาง 'edge'"
docker network inspect edge >/dev/null 2>&1 || docker network create edge

echo ""
echo "เสร็จแล้ว ✅ — ขั้นถัดไป: สร้าง .env ทั้งสองชุดจาก deploy/.env.example"
