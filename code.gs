/**
 * Apps Script의 서버측 코드입니다.
 * 이 코드는 Google Sheet와 웹 페이지(index.html) 사이의 통신을 담당합니다.
 */

// 사용할 시트의 이름을 상수로 정의합니다.
const SHEET_NAME = "학생정보";

/**
 * 문자열을 안전하게 정규화합니다: 문자열로 변환하고 양쪽 공백을 제거합니다.
 * Sheets에서 가져온 데이터 타입 불일치 및 숨겨진 공백 문제를 해결하기 위해 필수적입니다.
 * 특히, Date 객체인 경우 YYYYMMDD 형식의 문자열로 변환합니다.
 * @param {any} value - 정규화할 값
 * @returns {string} 정규화된 문자열
 */
function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  
  if (value instanceof Date) {
    // Sheets에서 Date 객체로 가져온 경우 YYYYMMDD 문자열로 변환 (예: 2005-01-01T00:00:00.000Z -> 20050101)
    // toLocaleDateString을 사용하여 로컬 시간대에 맞는 날짜를 가져온 후, 숫자만 추출합니다.
    const dateString = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyyMMdd");
    return dateString;
  }
  
  // 일반 문자열이나 숫자는 문자열로 변환하고 트림합니다.
  return value.toString().trim();
}

/**
 * 웹 앱에 index.html 파일을 서비스합니다.
 * @param {Object} e 이벤트 객체
 * @returns {HtmlOutput} index.html의 내용
 */
function doGet(e) {
  // HTML 서비스가 자동으로 Tailwind CSS를 로드하도록 설정합니다.
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // iframe 임베딩 허용
      .setTitle("아이디/비밀번호 조회 및 정보 입력 시스템");
}

/**
 * 새로운 학생 정보를 등록하거나 기존 학생의 플랫폼 계정 정보를 업데이트합니다.
 * @param {Object} data 학생 및 계정 정보 (name, studentId, dob, phone, id, password, platform)
 * @returns {string} 성공 또는 실패 메시지
 */
function saveStudentData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return "Error: 시트 이름(" + SHEET_NAME + ")을 찾을 수 없습니다. 시트 이름을 확인해주세요.";
  }
  
  // 데이터 검증 및 플랫폼 인덱스 설정
  let idIndex; // 0-based index for ID column
  let pwIndex; // 0-based index for PW column
  
  if (data.platform === 'Google') {
    idIndex = 4; // E열
    pwIndex = 5; // F열
  } else if (data.platform === 'Whale') {
    idIndex = 6; // G열
    pwIndex = 7; // H열
  } else {
    // 유효하지 않은 플랫폼 정보에 대한 에러 처리
    return "Error: 유효하지 않은 플랫폼 정보입니다. (Google 또는 Whale)"; 
  }

  // 클라이언트에서 받은 데이터를 정규화합니다.
  const inputName = normalizeString(data.name);
  const inputStudentId = normalizeString(data.studentId);
  const inputDob = normalizeString(data.dob);
  // 전화번호도 일반 문자열로 정규화 (하이픈 유지)
  const inputPhone = normalizeString(data.phone);
  
  const values = sheet.getDataRange().getValues();
  
  // 1. 기존 학생 정보가 있는지 찾습니다.
  let targetRowIndex = -1; // 시트 API용 1-based row index (데이터 행은 2부터 시작)
  
  for (let i = 1; i < values.length; i++) { // 헤더(0) 건너뛰기
    const row = values[i];
    
    // 시트에서 가져온 값을 정규화합니다. (날짜 객체 자동 변환 포함)
    const sheetName = normalizeString(row[0]);
    const sheetStudentId = normalizeString(row[1]);
    const sheetDob = normalizeString(row[2]);
    // 전화번호 하이픈 유지
    const sheetPhone = normalizeString(row[3]);
    
    // 입력된 조회 값과 스프레드시트 값을 비교합니다.
    if (
      sheetName === inputName &&
      sheetStudentId === inputStudentId &&
      sheetDob === inputDob &&
      sheetPhone === inputPhone
    ) {
      targetRowIndex = i + 1; // 1-based index (for Sheet API)
      break;
    }
  }

  try {
    if (targetRowIndex !== -1) {
      // 2. 기존 정보 업데이트 (Update)
      const range = sheet.getRange(targetRowIndex, 1, 1, values[0].length);
      const rowToUpdate = range.getValues()[0];
      
      // 선택된 플랫폼의 ID/PW 컬럼만 업데이트합니다.
      // 값이 없으면 빈 문자열로 저장합니다.
      rowToUpdate[idIndex] = data.id || '';
      rowToUpdate[pwIndex] = data.password || '';
      
      range.setValues([rowToUpdate]);
      
      return `학생 정보와 ${data.platform} 계정 정보가 성공적으로 업데이트되었습니다!`;
      
    } else {
      // 3. 새로운 학생 정보 저장 (New)
      
      // 기본 행 데이터 배열 (헤더의 컬럼 개수만큼)
      const newRow = Array(values[0].length).fill('');
      
      // 학생 식별 정보 (A, B, C, D) - 정규화된 값 사용
      newRow[0] = inputName; 
      newRow[1] = inputStudentId; 
      newRow[2] = inputDob; 
      newRow[3] = inputPhone;

      // 선택된 플랫폼의 ID/PW만 채웁니다.
      newRow[idIndex] = data.id || '';
      newRow[pwIndex] = data.password || '';
      
      sheet.appendRow(newRow);
      
      return `새 학생 정보와 ${data.platform} 계정 정보가 성공적으로 등록되었습니다!`;
    }
  } catch (error) {
    Logger.log(error);
    return "Error: 정보 처리 중 오류가 발생했습니다: " + error.message;
  }
}

/**
 * 학생 정보를 기반으로 아이디와 비밀번호를 조회합니다.
 * @param {Object} lookupInfo 조회 정보 (name, studentId, dob, phone, platform)
 * @returns {Object} 조회된 아이디/비밀번호 또는 오류 메시지
 */
function lookupCredentials(lookupInfo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return { error: "Error: 시트 이름(" + SHEET_NAME + ")을 찾을 수 없습니다. 시트 이름을 확인해주세요." };
  }
  
  // 플랫폼에 따라 아이디와 비밀번호의 컬럼 인덱스를 결정합니다.
  let idIndex;
  let pwIndex;
  
  if (lookupInfo.platform === 'Google') {
    idIndex = 4; // E열
    pwIndex = 5; // F열
  } else if (lookupInfo.platform === 'Whale') {
    idIndex = 6; // G열
    pwIndex = 7; // H열
  } else {
    return { error: "유효하지 않은 플랫폼 정보입니다." };
  }

  // 데이터가 있는 모든 행을 가져옵니다. (헤더 행 포함)
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length <= 1) {
    return { error: "조회할 데이터가 시트에 존재하지 않습니다." };
  }

  // 클라이언트에서 전달받은 조회 정보를 정규화합니다.
  const lookupName = normalizeString(lookupInfo.name);
  const lookupStudentId = normalizeString(lookupInfo.studentId);
  const lookupDob = normalizeString(lookupInfo.dob);
  // 전화번호 하이픈 유지
  const lookupPhone = normalizeString(lookupInfo.phone);

  // 헤더 행을 건너뛰고 실제 데이터만 검색합니다.
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    
    // 시트에서 가져온 값을 정규화합니다. (날짜 객체 자동 변환 포함)
    const sheetName = normalizeString(row[0]);
    const sheetStudentId = normalizeString(row[1]);
    const sheetDob = normalizeString(row[2]);
    // 전화번호 하이픈 유지
    const sheetPhone = normalizeString(row[3]);
    
    // 입력된 조회 값과 스프레드시트 값을 비교합니다.
    if (
      sheetName === lookupName &&
      sheetStudentId === lookupStudentId &&
      sheetDob === lookupDob &&
      sheetPhone === lookupPhone
    ) {
      // 선택된 플랫폼의 아이디/비밀번호를 반환합니다.
      const id = normalizeString(row[idIndex]);
      const password = normalizeString(row[pwIndex]);

      if (id === '' || password === '') {
           return { 
                warning: `학생 정보는 일치하지만, ${lookupInfo.platform} 계정의 아이디 또는 비밀번호가 아직 등록되지 않았습니다.` 
           };
      }
      
      return { 
        id: id, 
        password: password,
        platform: lookupInfo.platform
      };
    }
  }
  
  // 일치하는 데이터를 찾지 못한 경우
  return { error: "입력하신 정보와 일치하는 학생 정보가 없습니다. 입력 정보를 다시 확인해주세요." };
}

/**
 * 관리자 비밀번호를 확인하고 전체 학생 데이터를 반환합니다. (추가됨)
 * @param {string} password 관리자 비밀번호
 * @returns {Object} 성공 시 데이터 배열, 실패 시 에러 메시지
 */
function getAdminData(password) {
  const ADMIN_PASSWORD = 'rkghlwnd9107!'; // 요청하신 관리자 비밀번호

  if (password !== ADMIN_PASSWORD) {
    return { error: "관리자 비밀번호가 일치하지 않습니다." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return { error: "시트를 찾을 수 없습니다." };
  }

  const range = sheet.getDataRange();
  const values = range.getValues();

  // 데이터가 없거나 헤더만 있는 경우 처리
  if (values.length <= 1) {
    return { data: [] };
  }

  // 첫 번째 행(헤더)을 제외한 실제 데이터만 추출
  const data = values.slice(1);
  
  // 모든 셀 데이터를 안전한 문자열 형식으로 변환하여 전송 (날짜 변환 등 포함)
  const formattedData = data.map(row => {
    return row.map(cell => normalizeString(cell));
  });

  return { data: formattedData };
}
