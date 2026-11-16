# Oracle Cloud Always Free 배포 가이드

DIMENSION을 Oracle Cloud의 **평생 무료(Always Free)** 서버에 올리는 방법입니다.
신용카드 등록은 필요하지만, Always Free 범위 안에서만 쓰면 **과금되지 않습니다.**

준비물: 이메일, 신용카드(본인 확인용), 30분~1시간.

---

## 1단계. Oracle Cloud 가입

1. https://www.oracle.com/cloud/free/ 접속 → **Start for free** 클릭
2. 국가 **South Korea**, 이메일 입력 → 인증 메일 확인
3. 이름·비밀번호 설정
4. **Home Region** 선택 → **South Korea Central (Seoul)** 또는 **Japan East (Tokyo)** 선택
   - ⚠️ 한 번 정하면 바꿀 수 없습니다. **Seoul**을 권합니다.
5. 휴대폰 번호 인증
6. 신용카드 등록 (본인 확인용, **Always Free는 청구되지 않음**)
7. 가입 완료 후 로그인

## 2단계. 무료 서버(VM) 만들기

1. 좌측 상단 메뉴 → **Compute** → **Instances** → **Create instance**
2. 이름: `dimension` (아무거나)
3. **Image and shape** → **Edit**
   - Image: **Canonical Ubuntu** 최신 LTS (22.04 또는 24.04)
   - Shape: **Ampere (ARM)** → `VM.Standard.A1.Flex`
     - OCPU **1**, Memory **6 GB** 로 설정 (Always Free 범위)
     - ⚠️ ARM 용량이 없으면(`Out of host capacity`) **x86** `VM.Standard.E2.1.Micro` (Always Free)를 선택
4. **Add SSH keys** → **Generate a key pair for me** 선택 → **Private key 저장**
   - `.key` 파일이 내려받아집니다. **잘 보관하세요.**
5. **Create** 클릭 → 몇 분 뒤 **Running** 상태 확인
6. 인스턴스의 **Public IP address** 를 메모 (예: `123.45.67.89`)

## 3단계. 서버 접속 (SSH)

Windows는 PowerShell, Mac은 터미널을 열고:

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<Public-IP>
```

- Ubuntu 이미지의 기본 사용자는 `ubuntu` 입니다.
- 처음 접속 시 `yes` 입력.

## 4단계. Docker 설치 + 방화벽 열기 (자동)

접속한 서버에서:

```bash
sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/yoonsin6919689-alt/DI.git dimension
cd dimension
sudo bash deploy/oracle-setup.sh
```

이 스크립트가 Docker 설치와 **서버 내부 방화벽**을 자동으로 처리합니다.

## 5단계. VCN 방화벽 열기 (웹 콘솔, 수동 1회)

Oracle은 방화벽이 **두 겹**입니다. 스크립트가 내부를 열었으니, 이제 웹 콘솔에서 외부를 엽니다.

1. 인스턴스 페이지 → **Networking** 탭 → **Subnet** 링크 클릭
2. **Security Lists** → 기본 목록 클릭
3. **Add Ingress Rules** 클릭
4. 아래 값 입력 후 **Add Ingress Rules**
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: **TCP**
   - Destination Port Range: `80`
5. 같은 방법으로 포트 `443` 도 추가 (나중에 HTTPS용)

## 6단계. 사이트 실행

서버에서:

```bash
cd ~/dimension
printf 'STORAGE_SECRET=%s\nPUBLIC_ORIGIN=http://%s\nHOST_PORT=80\n' \
  "$(openssl rand -hex 32)" "$(curl -s ifconfig.me)" > .env
sudo docker compose up -d --build
```

빌드에 3~5분 걸립니다. 끝나면 확인:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/functions/v1/app/api/health
```

`200` 이 나오면 성공입니다.

## 7단계. 접속 확인

브라우저에서 `http://<Public-IP>` 접속 → DIMENSION 홈페이지가 보이면 완료.

---

## 자주 겪는 문제

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 접속이 안 됨(응답 없음) | VCN 방화벽 미개방 | **5단계** 다시 확인 |
| `Out of host capacity` | ARM 무료 용량 소진 | x86 `E2.1.Micro` 선택, 또는 다른 리전 |
| `docker: command not found` | 설치 전 | `sudo bash deploy/oracle-setup.sh` 재실행 |
| 이미지가 안 보임 | `STORAGE_SECRET` 미설정 | `.env` 확인 후 재시작 |
| 서버 재부팅 후 안 뜸 | 정책 | `restart: unless-stopped` 로 자동 복구됨 |

## 재배포 (코드 수정 후)

```bash
cd ~/dimension && git pull && sudo docker compose up -d --build
```

데이터(회원·글·사진)는 `dimension-data` 볼륨에 있어 재배포해도 유지됩니다.

## 선택: 도메인 연결 + HTTPS

무료 도메인을 쓰려면:
1. 도메인 준비 (예: DuckDNS, 또는 직접 구매한 도메인)
2. DNS의 A 레코드를 서버 Public IP로 설정
3. 서버에서 HTTPS 프록시 설치:
   ```bash
   sudo apt-get install -y caddy
   ```
4. `/etc/caddy/Caddyfile` 작성:
   ```
   dimension.example.com {
       reverse_proxy localhost:80
   }
   ```
5. `sudo systemctl restart caddy` → 인증서 자동 발급
6. `.env`의 `PUBLIC_ORIGIN`을 `https://dimension.example.com` 으로 변경 후 재시작
