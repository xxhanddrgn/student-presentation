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

## Railway 배포 (반 1개)

1. Railway에서 이 GitHub 저장소 연결 후 새 서비스 생성
2. **Variables**
   - `PORT` 는 Railway가 자동 주입 (수동 설정 불필요)
   - `DATA_DIR=/data` (SQLite 파일 위치)
   - `CLASS_ID=6-1` (또는 `6-2`, `6-3`. 미설정 시 기본 `6-1`)
3. **Volumes** → New Volume 생성, Mount Path `/data`
   - 이 볼륨에 `presentations.db` 파일이 저장되어 재배포 후에도 데이터가 유지됩니다.
4. Deploy 클릭 → 도메인(Generate Domain) 발급받아 접속

볼륨을 설정하지 않으면 재배포 시 기록이 사라질 수 있으니 반드시 볼륨을 연결하세요.

## 여러 반 운영 (6-1, 6-2, 6-3 동시 배포)

학급별로 데이터·URL을 완전히 분리하려면 **Railway 서비스를 반 수만큼** 만들면 됩니다.

1. 기존 서비스 = 6-1 용도로 그대로 사용 (필요 시 `CLASS_ID=6-1` 명시)
2. **6-2 서비스 신규 생성**
   - New Service → 같은 GitHub 저장소·브랜치 선택
   - Variables: `CLASS_ID=6-2`, `DATA_DIR=/data`
   - Volumes: **새 볼륨** 생성, Mount Path `/data`
   - Generate Domain
3. **6-3 서비스** 도 동일한 방식 (Variables: `CLASS_ID=6-3`, 반드시 **별도 볼륨**)

같은 저장소를 공유하므로 코드 업데이트는 세 서비스에 자동으로 전파됩니다.
데이터는 서비스별 볼륨에 격리되어 서로 섞이지 않습니다.

## 학생 명단 변경

`server.js` 상단의 `STUDENTS_BY_CLASS` 객체에서 해당 반 배열을 편집하세요.
새 반을 추가하려면 객체에 키를 하나 더 넣고, Railway에서 해당 `CLASS_ID`로 서비스를 만들면 됩니다.
