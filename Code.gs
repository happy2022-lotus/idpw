/**
 * Apps Script의 서버측 코드입니다.
 * 이 코드는 Google Sheet와 웹 페이지(index.html) 사이의 통신을 담당합니다.
 */

// 사용할 시트의 이름을 상수로 정의합니다.
const SHEET_NAME = "학생정보";

/**
 * 문자열을 안전하게 정규화합니다: 문자열로 변환하고 양쪽 공백을 제거합니다.
 */
function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  
  if (value instanceof Date) {
    const dateString = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyyMMdd");
    return dateString;
  }
  
  return value.toString().trim();
}

/**
 * 웹 앱에 index.html 파일을 서비스합니다.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle("아이디/비밀번호 조회 및 정보 입력 시스템");
}

/**
 * 새로운 학생 정보를 등록하거나 기존 학생의 플랫폼 계정 정보를 업데이트합니다.
 */
function saveStudentData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return "Error: 시트 이름(" + SHEET_NAME + ")을 찾을 수 없습니다.";
  }
  
  let idIndex;
  let pwIndex;
  
  if (data.platform === 'Google') {
    idIndex = 4; // E열
    pwIndex = 5; // F열
  } else if (data.platform === 'Whale') {
    idIndex = 6; // G열
    pwIndex = 7; // H열
  } else {
    return "Error: 유효하지 않은 플랫폼 정보입니다."; 
  }

  const inputName = normalizeString(data.name);
  const inputStudentId = normalizeString(data.studentId);
  const inputDob = normalizeString(data.dob);
  const inputPhone = normalizeString(data.phone);
  
  const values = sheet.getDataRange().getValues();
  let targetRowIndex = -1;
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sheetName = normalizeString(row[0]);
    const sheetStudentId = normalizeString(row[1]);
    const sheetDob = normalizeString(row[2]);
    const sheetPhone = normalizeString(row[3]);
    
    if (
      sheetName === inputName &&
      sheetStudentId === inputStudentId &&
      sheetDob === inputDob &&
      sheetPhone === inputPhone
    ) {
      targetRowIndex = i + 1;
      break;
    }
  }

  try {
    if (targetRowIndex !== -1) {
      const range = sheet.getRange(targetRowIndex, 1, 1, values[0].length);
      const rowToUpdate = range.getValues()[0];
      rowToUpdate[idIndex] = data.id || '';
      rowToUpdate[pwIndex] = data.password || '';
      range.setValues([rowToUpdate]);
      return `학생 정보와 ${data.platform} 계정 정보가 성공적으로 업데이트되었습니다!`;
    } else {
      const newRow = Array(values[0].length).fill('');
      newRow[0] = inputName; 
      newRow[1] = inputStudentId; 
      newRow[2] = inputDob; 
      newRow[3] = inputPhone;
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
 */
function lookupCredentials(lookupInfo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return { error: "Error: 시트 이름(" + SHEET_NAME + ")을 찾을 수 없습니다." };
  }
  
  let idIndex;
  let pwIndex;
  
  if (lookupInfo.platform === 'Google') {
    idIndex = 4;
    pwIndex = 5;
  } else if (lookupInfo.platform === 'Whale') {
    idIndex = 6;
    pwIndex = 7;
  } else {
    return { error: "유효하지 않은 플랫폼 정보입니다." };
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length <= 1) {
    return { error: "조회할 데이터가 시트에 존재하지 않습니다." };
  }

  const lookupName = normalizeString(lookupInfo.name);
  const lookupStudentId = normalizeString(lookupInfo.studentId);
  const lookupDob = normalizeString(lookupInfo.dob);
  const lookupPhone = normalizeString(lookupInfo.phone);

  // [보안] 개인정보 보호를 위해 상세 로그는 주석 처리하거나 제거합니다.
  // Logger.log('Client Data: %s, %s, %s, %s', lookupName, lookupStudentId, lookupDob, lookupPhone);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sheetName = normalizeString(row[0]);
    const sheetStudentId = normalizeString(row[1]);
    const sheetDob = normalizeString(row[2]);
    const sheetPhone = normalizeString(row[3]);
    
    if (
      sheetName === lookupName &&
      sheetStudentId === lookupStudentId &&
      sheetDob === lookupDob &&
      sheetPhone === lookupPhone
    ) {
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
  
  return { error: "입력하신 정보와 일치하는 학생 정보가 없습니다. 입력 정보를 다시 확인해주세요." };
}

/**
 * 관리자 비밀번호를 확인하고 전체 학생 데이터를 반환합니다.
 * [보안 강화] 비밀번호는 코드에 직접 쓰지 않고 스크립트 속성에서 가져옵니다.
 */
function getAdminData(password) {
  // 스크립트 속성에서 'ADMIN_PASSWORD'를 가져옵니다. 
  // 설정이 안 되어 있다면 기본값으로 '비밀번호'를 사용합니다.
  const scriptProperties = PropertiesService.getScriptProperties();
  const savedPassword = scriptProperties.getProperty('ADMIN_PASSWORD') || '비밀번호';

  if (password !== savedPassword) {
    return { error: "관리자 비밀번호가 일치하지 않습니다." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return { error: "시트를 찾을 수 없습니다." };
  }

  const range = sheet.getDataRange();
  const values = range.getValues();

  if (values.length <= 1) {
    return { data: [] };
  }

  const data = values.slice(1);
  const formattedData = data.map(row => {
    return row.map(cell => normalizeString(cell));
  });

  return { data: formattedData };
}
