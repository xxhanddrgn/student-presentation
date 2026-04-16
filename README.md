# 우리 반 발표 현황 트래커

교사가 학생 15명의 주별 발표 횟수를 체크하는 웹 앱입니다.

## 기능

- 주별(ISO week) 발표 체크: `+` / `−` 버튼으로 학생별 발표 횟수 기록
- 이전/다음/이번 주 이동
- 연도별 전체 요약표 (각 주 횟수 + 합계)
- SQLite 파일 DB에 저장 → Railway 볼륨으로 영구 보존

## 로컬 실행

```bash
npm install
npm start
```

기본 포트 `3000`. 브라우저에서 http://localhost:3000 접속.

## Railway 배포

1. Railway에서 이 GitHub 저장소 연결 후 새 서비스 생성
2. **Variables**
   - `PORT` 는 Railway가 자동 주입 (수동 설정 불필요)
   - `DATA_DIR=/data` (SQLite 파일 위치)
3. **Volumes** → New Volume 생성, Mount Path `/data`
   - 이 볼륨에 `presentations.db` 파일이 저장되어 재배포 후에도 데이터가 유지됩니다.
4. Deploy 클릭 → 도메인(Generate Domain) 발급받아 접속

볼륨을 설정하지 않으면 재배포 시 기록이 사라질 수 있으니 반드시 볼륨을 연결하세요.

## 학생 명단 변경

`server.js` 상단의 `STUDENTS` 배열을 편집하세요.
