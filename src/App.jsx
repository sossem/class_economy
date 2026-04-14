import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, ShoppingCart, Award, Users, Settings, LogOut, Download, PlusCircle, 
  UserCheck, BookOpen, Medal, ListOrdered, CheckSquare, Edit, Trash2, 
  Briefcase, Calendar, Sliders, CreditCard, UploadCloud, FileSpreadsheet, Lock, Key
} from 'lucide-react';

// Firebase Imports (Cloud DB & Auth)
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, deleteDoc } from "firebase/firestore";

// Firebase Setup
const firebaseConfig = {
  apiKey: "AIzaSyAgupnwqCV-G8GZ3_obq2VvMPSVjhwT_ZQ",
  authDomain: "class-economy-2026.firebaseapp.com",
  projectId: "class-economy-2026",
  storageBucket: "class-economy-2026.firebasestorage.app",
  messagingSenderId: "38808697803",
  appId: "1:38808697803:web:680505723990441beb944e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'class-economy-app';

// DB Reference Helpers
const getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getDocRef = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, String(docId));

const ClassEconomyApp = () => {
  // --------------------------------------------------------
  // 1. Firebase Auth & Role State
  // --------------------------------------------------------
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState(null); // 'teacher' | 'student' | null
  const [loginStep, setLoginStep] = useState('select'); // 'select', 'teacher_pin', 'student_select'
  const [pinInput, setPinInput] = useState('');

  // --------------------------------------------------------
  // 2. Global Data States (Synced with Firestore)
  // --------------------------------------------------------
  const [config, setConfig] = useState({ platformName: '우리반 경제 플랫폼', currency: '미소', classTax: 0, teacherPin: '0000', teacherUid: null, lastAutoPayDate: '' });
  const [allStudents, setAllStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [readingData, setReadingData] = useState([]);
  const [rolesData, setRolesData] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  // Local UI State
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [globalMessage, setGlobalMessage] = useState({ text: '', type: '' });

  // Current logged in student data (if role === 'student')
  const studentData = allStudents.find(s => s.uid === user?.uid);
  const isAdmin = currentRole === 'teacher';

  const showMessage = (text, type = 'success') => {
    setGlobalMessage({ text, type });
    setTimeout(() => setGlobalMessage({ text: '', type: '' }), 3000);
  };

  // --------------------------------------------------------
  // 3. Database Initialization & Auth Flow
  // --------------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();

    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Database Seeder (Run once if settings don't exist)
    const checkAndSeedDB = async () => {
      try {
        const configSnap = await getDoc(getDocRef('settings', 'config'));
        if (!configSnap.exists()) {
          console.log("Seeding initial database...");
          await setDoc(getDocRef('settings', 'config'), { 
            platformName: '우리반 경제 플랫폼', currency: '미소', classTax: 4500, teacherPin: '0000', teacherUid: null, lastAutoPayDate: '' 
          });
          
          const initialStudents = [
            { id: 1, number: '1번', name: '김철수', asset: 15000, uid: null },
            { id: 2, number: '2번', name: '이영희', asset: 22000, uid: null },
            { id: 3, number: '3번', name: '박지민', asset: 8000, uid: null }
          ];
          for(let s of initialStudents) await setDoc(getDocRef('students', s.id), s);

          const initialItems = [
            { id: 1, name: '자리 변경 우선권', price: 10000, stock: 3 },
            { id: 2, name: '숙제 1회 면제권', price: 15000, stock: 5 },
            { id: 3, name: '미니 간식 세트', price: 2000, stock: 20 }
          ];
          for(let i of initialItems) await setDoc(getDocRef('storeItems', i.id), i);

          const initialRoles = [
            { id: 1, dept: '학습부', role: '칠판 지우기', studentId: 1, studentName: '김철수', salary: 5000 },
            { id: 2, dept: '환경부', role: '분리수거', studentId: 2, studentName: '이영희', salary: 6000 }
          ];
          for(let r of initialRoles) await setDoc(getDocRef('rolesData', r.id), r);

          const initialReadings = [
            { id: 1, studentId: 1, name: '김철수', books: 12 },
            { id: 2, studentId: 2, name: '이영희', books: 25 }
          ];
          for(let rd of initialReadings) await setDoc(getDocRef('readingData', rd.id), rd);
        }
      } catch (err) {
        console.error("Database seeding error:", err);
      }
    };
    checkAndSeedDB();

    // Setup Realtime Listeners
    const unsubs = [];
    const subscribe = (colName, setter) => {
      unsubs.push(onSnapshot(getColRef(colName), (snap) => {
        const data = snap.docs.map(d => ({...d.data(), _id: d.id}));
        // Sort items by ID generally to keep order
        setter(data.sort((a, b) => a.id - b.id));
      }, (err) => console.error(`Err listening to ${colName}:`, err)));
    };

    unsubs.push(onSnapshot(getDocRef('settings', 'config'), (snap) => {
      if(snap.exists()) {
        const conf = snap.data();
        setConfig(conf);
        // Auto-login logic check
        if (conf.teacherUid === user.uid) setCurrentRole('teacher');
      }
    }, (err) => console.error(`Err listening to config:`, err)));

    subscribe('students', (data) => {
      setAllStudents(data);
      // Auto-login logic check for students
      if (data.some(s => s.uid === user.uid)) setCurrentRole('student');
    });
    subscribe('transactions', (data) => setTransactions(data.sort((a,b) => b.id - a.id))); // Sort newest first
    subscribe('storeItems', setStoreItems);
    subscribe('readingData', setReadingData);
    subscribe('rolesData', setRolesData);
    subscribe('purchaseHistory', (data) => setPurchaseHistory(data.sort((a,b) => b.id - a.id)));

    return () => unsubs.forEach(fn => fn());
  }, [user]);

  // --------------------------------------------------------
  // 4. Action Handlers (Writing to DB)
  // --------------------------------------------------------
  
  // 금요일 자동 지급 (교사가 로그인했을 때 단 1회만 실행되도록 보호)
  useEffect(() => {
    const checkAutoPay = async () => {
      if (currentRole === 'teacher' && config.platformName) {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        
        if (today.getDay() === 5 && config.lastAutoPayDate !== dateString) {
          // Update DB immediately to prevent double firing
          await setDoc(getDocRef('settings', 'config'), { ...config, lastAutoPayDate: dateString });
          executeRoleSalaryPayment(true);
        }
      }
    };
    checkAutoPay();
  }, [currentRole, config]);

  const executeRoleSalaryPayment = async (isAuto = false) => {
    let totalTaxCollected = 0;
    
    for (const student of allStudents) {
      const studentRole = rolesData.find(r => r.studentId === student.id);
      if (studentRole && studentRole.salary > 0) {
        const tax = Math.floor(studentRole.salary * 0.1);
        const netIncome = studentRole.salary - tax;
        totalTaxCollected += tax;
        
        // Update Student Asset
        await setDoc(getDocRef('students', student.id), { ...student, asset: student.asset + netIncome });
        
        // Add Transaction
        const txId = Date.now() + Math.random();
        await setDoc(getDocRef('transactions', txId), {
          id: txId,
          studentId: student.id,
          date: new Date().toISOString().split('T')[0],
          type: '수입',
          desc: `[${studentRole.dept}] ${studentRole.role} 주급 ${isAuto ? '(자동지급)' : ''}`,
          amount: netIncome,
          balance: student.asset + netIncome,
          note: `세금 ${tax} 징수`
        });
      }
    }

    if (totalTaxCollected > 0) {
      await setDoc(getDocRef('settings', 'config'), { ...config, classTax: config.classTax + totalTaxCollected });
    }
    showMessage(isAuto ? '🎉 금요일 부서 역할 수당이 자동 지급되었습니다.' : '부서 역할 수당 일괄 지급이 완료되었습니다.');
  };

  const handlePurchase = async (item) => {
    if (studentData.asset < item.price) return showMessage('잔액이 부족합니다.', 'error');
    if (item.stock <= 0) return showMessage('재고가 모두 소진되었습니다.', 'error');

    const newAsset = studentData.asset - item.price;
    const today = new Date().toISOString().split('T')[0];
    const newTxId = Date.now();

    // 1. 차감
    await setDoc(getDocRef('students', studentData.id), { ...studentData, asset: newAsset });
    // 2. 재고 감소
    await setDoc(getDocRef('storeItems', item.id), { ...item, stock: item.stock - 1 });
    // 3. 출납부 기록
    await setDoc(getDocRef('transactions', newTxId), {
      id: newTxId, studentId: studentData.id, date: today, type: '지출', 
      desc: `상점 - ${item.name} 구매`, amount: item.price, balance: newAsset, note: '대기'
    });
    // 4. 관리자 주문 접수
    await setDoc(getDocRef('purchaseHistory', newTxId), {
      id: newTxId, studentId: studentData.id, date: today, student: `${studentData.number} ${studentData.name}`, item: item.name, status: '대기'
    });

    showMessage(`${item.name} 구매가 완료되었습니다!`);
  };

  const handleLogin = async (type) => {
    if (type === 'teacher') {
      if (pinInput === config.teacherPin) {
        await setDoc(getDocRef('settings', 'config'), { ...config, teacherUid: user.uid });
        setCurrentRole('teacher');
      } else {
        showMessage('비밀번호가 틀렸습니다. (기본값: 0000)', 'error');
      }
    }
  };

  const handleStudentLogin = async (student) => {
    if (student.uid && student.uid !== user.uid) {
      showMessage('이미 다른 기기에서 연결된 계정입니다. 선생님께 초기화를 요청하세요.', 'error');
      return;
    }
    // 계정에 현재 브라우저 UID 맵핑
    await setDoc(getDocRef('students', student.id), { ...student, uid: user.uid });
    setCurrentRole('student');
  };

  const handleLogout = async () => {
    // 로컬에서의 역할만 리셋 (기기 변경을 위함)
    setCurrentRole(null);
    setLoginStep('select');
    setPinInput('');
  };


  // --------------------------------------------------------
  // 5. Auth / Loading Views
  // --------------------------------------------------------
  if (authLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-slate-50"><p className="text-xl font-bold text-slate-400 animate-pulse">데이터베이스 연결 중...</p></div>;
  }

  if (!currentRole) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 p-4">
        {globalMessage.text && (
          <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl font-bold text-center shadow-xl z-50 transition-all duration-300 ${
            globalMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}>
            {globalMessage.text}
          </div>
        )}
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{config.platformName}</h1>
          <p className="text-slate-500 mb-8">환영합니다! 역할을 선택해 주세요.</p>

          {loginStep === 'select' && (
            <div className="space-y-4">
              <button onClick={() => setLoginStep('student_select')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-sm flex items-center justify-center space-x-2">
                <Users size={20} /> <span>학생으로 시작하기</span>
              </button>
              <button onClick={() => setLoginStep('teacher_pin')} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold text-lg hover:bg-slate-900 transition shadow-sm flex items-center justify-center space-x-2">
                <Key size={20} /> <span>선생님으로 시작하기</span>
              </button>
            </div>
          )}

          {loginStep === 'teacher_pin' && (
            <div className="space-y-4">
              <input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value)} placeholder="관리자 비밀번호 입력" className="w-full p-4 border border-slate-300 rounded-xl text-center text-xl tracking-[0.5em] focus:outline-blue-500" />
              <button onClick={() => handleLogin('teacher')} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition">인증하기</button>
              <button onClick={() => setLoginStep('select')} className="text-slate-400 text-sm hover:underline">뒤로 가기</button>
            </div>
          )}

          {loginStep === 'student_select' && (
            <div className="space-y-4 text-left">
              <p className="text-sm font-semibold text-slate-600 mb-2">본인의 이름을 선택하세요.</p>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y">
                {allStudents.length === 0 ? <p className="p-4 text-center text-slate-400 text-sm">등록된 학생이 없습니다. 교사에게 문의하세요.</p> : null}
                {allStudents.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => handleStudentLogin(s)}
                    className="w-full p-4 hover:bg-blue-50 text-left transition flex justify-between items-center"
                  >
                    <span className="font-bold text-slate-700">{s.number} {s.name}</span>
                    {s.uid === user.uid && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">내 계정</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => setLoginStep('select')} className="w-full text-center text-slate-400 text-sm hover:underline mt-4">뒤로 가기</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // 6. Main App UI Components
  // --------------------------------------------------------
  
  // 학생용 필터링된 데이터
  const myTransactions = transactions.filter(tx => tx.studentId === studentData?.id);

  const Sidebar = () => (
    <div className="w-64 bg-slate-800 text-white flex flex-col min-h-screen shrink-0">
      <div className="p-5 text-xl font-bold border-b border-slate-700 flex justify-between items-center">
        <span>{config.platformName}</span>
      </div>
      <div className="p-4 flex items-center space-x-3 border-b border-slate-700">
        <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center shrink-0">
          <UserCheck size={20} />
        </div>
        <div className="overflow-hidden">
          <p className="text-sm text-slate-300 truncate">{isAdmin ? '관리자 (선생님)' : `${studentData?.number} ${studentData?.name}`}</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
          <Home size={20} /> <span>대시보드 (출납부)</span>
        </button>
        <button onClick={() => setActiveMenu('store')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'store' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
          <ShoppingCart size={20} /> <span>상점</span>
        </button>
        <button onClick={() => setActiveMenu('reading')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'reading' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
          <Award size={20} /> <span>독서 명예의 전당</span>
        </button>
        <button onClick={() => setActiveMenu('roles')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'roles' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
          <Users size={20} /> <span>학급 부서 역할</span>
        </button>
        
        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-700 space-y-2">
            <p className="px-3 text-xs text-slate-400 font-semibold mb-2">관리자 메뉴</p>
            <button onClick={() => setActiveMenu('admin-assets')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'admin-assets' ? 'bg-blue-600' : 'hover:bg-slate-700'} text-yellow-400`}>
              <ListOrdered size={20} /> <span>전체 자산 관리</span>
            </button>
            <button onClick={() => setActiveMenu('admin-store')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'admin-store' ? 'bg-blue-600' : 'hover:bg-slate-700'} text-yellow-400`}>
              <ShoppingCart size={20} /> <span>주문/상점 관리</span>
            </button>
            <button onClick={() => setActiveMenu('admin-reading')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'admin-reading' ? 'bg-blue-600' : 'hover:bg-slate-700'} text-yellow-400`}>
              <BookOpen size={20} /> <span>독서 검사/수당</span>
            </button>
            <button onClick={() => setActiveMenu('admin-roles')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'admin-roles' ? 'bg-blue-600' : 'hover:bg-slate-700'} text-yellow-400`}>
              <Briefcase size={20} /> <span>부서/역할 설정</span>
            </button>
            <button onClick={() => setActiveMenu('admin-transfer')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'admin-transfer' ? 'bg-blue-600' : 'hover:bg-slate-700'} text-yellow-400`}>
              <CreditCard size={20} /> <span>급여/세금 일괄처리</span>
            </button>
            <button onClick={() => setActiveMenu('admin-settings')} className={`w-full flex items-center space-x-3 p-3 rounded-lg ${activeMenu === 'admin-settings' ? 'bg-blue-600' : 'hover:bg-slate-700'} text-yellow-400`}>
              <Sliders size={20} /> <span>기본설정 & 명단</span>
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button onClick={handleLogout} className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-700 text-red-400 transition">
          <LogOut size={20} /> <span>기기에서 로그아웃</span>
        </button>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">자산 요약</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">나의 현재 자산</p>
          <div className="text-3xl font-bold text-blue-600">{isAdmin ? '-' : studentData?.asset.toLocaleString()} {config.currency}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">학급 누적 세금 (국고)</p>
          <div className="text-3xl font-bold text-emerald-600">{config.classTax.toLocaleString()} {config.currency}</div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{isAdmin ? '전체 최신 거래내역' : '내 출납부'}</h2>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b">
              <th className="p-4 font-semibold">날짜</th>
              {isAdmin && <th className="p-4 font-semibold">대상</th>}
              <th className="p-4 font-semibold">내용</th>
              <th className="p-4 font-semibold text-right">수입</th>
              <th className="p-4 font-semibold text-right">지출</th>
              <th className="p-4 font-semibold text-right">잔액</th>
              <th className="p-4 font-semibold text-center">비고</th>
            </tr>
          </thead>
          <tbody>
            {(isAdmin ? transactions : myTransactions).slice(0, 15).map((tx) => (
              <tr key={tx.id} className="border-b hover:bg-slate-50">
                <td className="p-4 text-slate-600">{tx.date}</td>
                {isAdmin && <td className="p-4 font-medium">{allStudents.find(s=>s.id===tx.studentId)?.name || '알수없음'}</td>}
                <td className="p-4">{tx.desc}</td>
                <td className="p-4 text-right text-blue-600 font-medium">{tx.type === '수입' ? `+${tx.amount.toLocaleString()}` : '-'}</td>
                <td className="p-4 text-right text-red-500 font-medium">{tx.type === '지출' ? `${tx.amount.toLocaleString()}` : '-'}</td>
                <td className="p-4 text-right font-bold">{tx.balance.toLocaleString()}</td>
                <td className="p-4 text-center">
                  {tx.note === '수령완료' ? (
                    <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-medium">수령완료</span>
                  ) : <span className="text-xs text-slate-500">{tx.note}</span>}
                </td>
              </tr>
            ))}
            {(isAdmin ? transactions : myTransactions).length === 0 && (
              <tr><td colSpan={isAdmin?7:6} className="p-8 text-center text-slate-400">거래 내역이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const StoreView = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">학급 상점</h2>
        <div className="text-lg font-semibold text-slate-700 bg-white px-4 py-2 rounded-lg border shadow-sm">
          내 잔액: <span className="text-blue-600">{isAdmin ? '-' : studentData?.asset.toLocaleString()} {config.currency}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {storeItems.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="h-32 bg-slate-100 rounded-lg mb-4 flex items-center justify-center">
              <ShoppingCart size={40} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold mb-2">{item.name}</h3>
            <p className="text-2xl font-bold text-blue-600 mb-4">{item.price.toLocaleString()} {config.currency}</p>
            <p className="text-sm text-slate-500 mb-4">남은 수량: {item.stock}개</p>
            <button 
              onClick={() => handlePurchase(item)}
              disabled={item.stock <= 0 || isAdmin}
              className={`mt-auto w-full py-2 rounded-lg transition font-medium ${
                isAdmin ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                item.stock > 0 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isAdmin ? '관리자는 구매 불가' : item.stock > 0 ? '구매하기' : '품절'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const ReadingView = () => {
    const allBadges = [
      { req: 0, icon: '🌱', color: 'bg-green-100 text-green-800 border-green-200', name: '독서 새싹' },
      { req: 10, icon: '🥈', color: 'bg-slate-100 text-slate-800 border-slate-200', name: '10권 달성' },
      { req: 20, icon: '🥇', color: 'bg-amber-100 text-amber-800 border-amber-200', name: '20권 우수상' },
      { req: 100, icon: '👑', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', name: '100권 마스터' },
    ];
    const getBadge = (books) => [...allBadges].reverse().find(b => books >= b.req) || allBadges[0];
    
    const myReadingInfo = readingData.find(s => s.studentId === studentData?.id) || { books: 0 };
    const myBooks = myReadingInfo.books;
    const nextMyGoal = myBooks < 10 ? 10 : myBooks < 20 ? 20 : myBooks < 100 ? 100 : 100;
    const myProgress = Math.min((myBooks / nextMyGoal) * 100, 100);

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">독서 명예의 전당</h2>
        
        {!isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
            <h3 className="text-lg font-bold mb-4 flex items-center"><BookOpen className="text-blue-500 mr-2" /> 나의 독서 현황</h3>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex-shrink-0 text-center lg:text-left">
                <p className="text-sm text-slate-500 font-medium">현재까지 작성한 독서기록장</p>
                <div className="flex items-baseline justify-center lg:justify-start space-x-2 mt-1">
                  <span className="text-4xl font-extrabold text-blue-600">{myBooks}</span>
                  <span className="text-xl font-bold text-slate-600">권</span>
                </div>
              </div>
              <div className="flex-1 w-full max-w-xl">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500">다음 목표까지 진행률</span>
                  <span className="text-xs font-bold text-blue-600">{Math.floor(myProgress)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-4 shadow-inner mb-6">
                  <div className="bg-blue-500 h-4 rounded-full transition-all" style={{ width: `${myProgress}%` }}></div>
                </div>
                <div className="flex space-x-2 justify-end">
                  {allBadges.map((badge, idx) => {
                    const isEarned = myBooks >= badge.req;
                    return (
                      <div key={idx} className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${isEarned ? `${badge.color} shadow-sm` : 'bg-slate-50 border-slate-200 opacity-40 grayscale'}`}>
                        <span className="text-3xl mb-1">{badge.icon}</span>
                        <span className="text-[10px] font-bold text-center">{badge.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center"><Medal className="text-yellow-500 mr-2" /> 우리반 독서 랭킹</h3>
          <div className="space-y-4">
            {[...readingData].sort((a, b) => b.books - a.books).map((student, index) => {
              const badge = getBadge(student.books);
              return (
                <div key={student.id} className="flex items-center p-4 border rounded-lg hover:bg-slate-50 transition">
                  <div className="w-12 font-bold text-slate-400">{index + 1}위</div>
                  <div className="w-24 font-bold">{student.name}</div>
                  <div className="w-32 text-blue-600 font-semibold">{student.books}권 읽음</div>
                  <div className="flex-1 px-4 hidden md:block"></div>
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${badge.color}`}>
                    <span className="text-lg">{badge.icon}</span>
                    <span className="text-xs font-bold">{badge.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const RolesView = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">학급 부서 역할</h2>
      </div>
      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6 flex items-center">
        <Calendar size={20} className="mr-2 text-blue-600 shrink-0" />
        <span className="text-sm font-medium">매주 금요일마다 본인이 맡은 역할에 따른 수당이 자동으로 출납부에 지급됩니다! (세금 10% 공제)</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b">
              <th className="p-4 font-semibold">부서명</th>
              <th className="p-4 font-semibold">담당 역할</th>
              <th className="p-4 font-semibold">담당 학생</th>
              <th className="p-4 font-semibold text-right">주급({config.currency})</th>
            </tr>
          </thead>
          <tbody>
            {rolesData.map((role) => (
              <tr key={role.id} className="border-b hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-700"><Briefcase size={16} className="inline mr-2 text-slate-400"/>{role.dept}</td>
                <td className="p-4">{role.role}</td>
                <td className="p-4 font-semibold text-blue-600">{role.studentName}</td>
                <td className="p-4 text-right font-bold">{role.salary.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --------------------------------------------------------
  // 7. Admin Views (Fully DB Connected)
  // --------------------------------------------------------
  const AdminAssetsView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">전체 학생 자산 관리</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <span className="text-sm font-semibold text-slate-600">총 인원: {allStudents.length}명</span>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b">
              <th className="p-4 font-semibold">번호</th>
              <th className="p-4 font-semibold">이름</th>
              <th className="p-4 font-semibold text-right">자산 총액({config.currency})</th>
              <th className="p-4 font-semibold text-center">순위</th>
            </tr>
          </thead>
          <tbody>
            {[...allStudents].sort((a, b) => b.asset - a.asset).map((s, idx) => (
              <tr key={s.id} className="border-b hover:bg-slate-50">
                <td className="p-4 text-slate-600">{s.number}</td>
                <td className="p-4 font-bold">{s.name}</td>
                <td className="p-4 text-right text-blue-600 font-bold">{s.asset.toLocaleString()}</td>
                <td className="p-4 text-center text-slate-500 font-medium">{idx + 1}위</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const AdminStoreView = () => {
    const [tab, setTab] = useState('orders');
    const [selectedOrders, setSelectedOrders] = useState([]);
    
    // 새 상품 등록용 인라인 폼 상태
    const [showNewItemForm, setShowNewItemForm] = useState(false);
    const [newItem, setNewItem] = useState({name: '', price: '', stock: ''});

    const handleBulkComplete = async () => {
      if (selectedOrders.length === 0) return;
      for(const id of selectedOrders) {
        const order = purchaseHistory.find(o => o.id === id);
        if(order) {
           await setDoc(getDocRef('purchaseHistory', id), { ...order, status: '완료' });
           const txRef = getDocRef('transactions', id);
           const txSnap = await getDoc(txRef);
           if(txSnap.exists()) await setDoc(txRef, { ...txSnap.data(), note: '수령완료' });
        }
      }
      setSelectedOrders([]);
      showMessage('일괄 배부 처리 되었습니다.');
    };

    const toggleSelectAll = (e) => {
      if (e.target.checked) setSelectedOrders(purchaseHistory.filter(o => o.status === '대기').map(o => o.id));
      else setSelectedOrders([]);
    };

    const handleAddNewItem = () => {
      if(newItem.name && newItem.price && newItem.stock) {
        const id = Date.now();
        setDoc(getDocRef('storeItems', id), { 
          id, 
          name: newItem.name, 
          price: parseInt(newItem.price), 
          stock: parseInt(newItem.stock) 
        });
        setNewItem({name: '', price: '', stock: ''});
        setShowNewItemForm(false);
        showMessage('새 상품이 등록되었습니다.');
      } else {
        showMessage('상품명, 가격, 수량을 모두 입력해주세요.', 'error');
      }
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">상점 및 주문 관리</h2>
        <div className="flex space-x-4 mb-6">
          <button onClick={() => setTab('orders')} className={`px-4 py-2 rounded-lg font-semibold transition ${tab === 'orders' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>학생 구매 내역 (배부 처리)</button>
          <button onClick={() => setTab('items')} className={`px-4 py-2 rounded-lg font-semibold transition ${tab === 'items' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>판매 상품 관리</button>
        </div>

        {tab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <span className="text-sm font-semibold text-slate-600">처리 대기 중인 주문</span>
              <button onClick={handleBulkComplete} disabled={selectedOrders.length === 0} className={`text-sm flex items-center space-x-2 px-3 py-1.5 rounded transition ${selectedOrders.length > 0 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                <CheckSquare size={14} /> <span>선택 항목 완료처리</span>
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b">
                  <th className="p-4 w-12 text-center"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>
                  <th className="p-4 font-semibold">신청일</th>
                  <th className="p-4 font-semibold">학생명</th>
                  <th className="p-4 font-semibold">구매 상품</th>
                  <th className="p-4 font-semibold text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {purchaseHistory.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 text-center">
                      <input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => {
                        setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i=>i!==order.id) : [...prev, order.id]);
                      }} disabled={order.status === '완료'} className="rounded" />
                    </td>
                    <td className="p-4 text-slate-600">{order.date}</td>
                    <td className="p-4 font-medium">{order.student}</td>
                    <td className="p-4 font-bold text-blue-600">{order.item}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === '대기' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>{order.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'items' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b flex justify-end bg-slate-50">
              <button onClick={() => setShowNewItemForm(!showNewItemForm)} className="text-sm flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                <PlusCircle size={14} /> <span>새 상품 등록</span>
              </button>
            </div>
            
            {/* 새 상품 등록 인라인 폼 */}
            {showNewItemForm && (
              <div className="p-4 bg-blue-50 border-b flex flex-wrap gap-2 items-center">
                <input type="text" placeholder="상품명" value={newItem.name} onChange={e=>setNewItem({...newItem, name: e.target.value})} className="p-2 border rounded text-sm flex-1" />
                <input type="number" placeholder="가격" value={newItem.price} onChange={e=>setNewItem({...newItem, price: e.target.value})} className="p-2 border rounded text-sm w-32" />
                <input type="number" placeholder="수량" value={newItem.stock} onChange={e=>setNewItem({...newItem, stock: e.target.value})} className="p-2 border rounded text-sm w-24" />
                <button onClick={handleAddNewItem} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700">추가</button>
              </div>
            )}

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b">
                  <th className="p-4 font-semibold">상품명</th>
                  <th className="p-4 font-semibold text-right">가격({config.currency})</th>
                  <th className="p-4 font-semibold text-right">수량</th>
                  <th className="p-4 font-semibold text-center">삭제</th>
                </tr>
              </thead>
              <tbody>
                {storeItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 font-bold">{item.name}</td>
                    <td className="p-4 text-right text-blue-600 font-medium">{item.price.toLocaleString()}</td>
                    <td className="p-4 text-right">{item.stock}개</td>
                    <td className="p-4 text-center">
                      <button onClick={()=>{
                        deleteDoc(getDocRef('storeItems', item.id));
                        showMessage('상품이 삭제되었습니다.');
                      }} className="text-slate-400 hover:text-red-500 mx-2"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const AdminReadingView = () => {
    const [addedBooks, setAddedBooks] = useState('');
    const [rewardPerBook, setRewardPerBook] = useState('500');
    
    const handleAddReading = async (studentId) => {
      if(!addedBooks) return showMessage("권수를 입력하세요", "error");
      const numBooks = parseInt(addedBooks);
      const reward = numBooks * parseInt(rewardPerBook || 0);
      
      const currentRec = readingData.find(r => r.studentId === studentId);
      const student = allStudents.find(s => s.id === studentId);
      
      // 1. Update reading count
      if(currentRec) {
        await setDoc(getDocRef('readingData', currentRec.id), { ...currentRec, books: currentRec.books + numBooks });
      } else {
        const newId = Date.now();
        await setDoc(getDocRef('readingData', newId), { id: newId, studentId, name: student.name, books: numBooks });
      }
      
      // 2. Add reward transaction if applicable
      if (reward > 0) {
        const tax = Math.floor(reward * 0.1);
        const netIncome = reward - tax;
        await setDoc(getDocRef('students', studentId), { ...student, asset: student.asset + netIncome });
        await setDoc(getDocRef('settings', 'config'), { ...config, classTax: config.classTax + tax });
        
        const txId = Date.now();
        await setDoc(getDocRef('transactions', txId), {
          id: txId, studentId, date: new Date().toISOString().split('T')[0], type: '수입',
          desc: `독서기록장 ${numBooks}권 달성 보상`, amount: netIncome, balance: student.asset + netIncome, note: `세금 ${tax} 징수`
        });
      }
      showMessage(`${student.name} 학생의 독서량과 수당이 반영되었습니다.`);
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">독서량 검사 및 수당 일괄 지급</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-wrap gap-4 items-center">
          <input type="number" value={addedBooks} onChange={e=>setAddedBooks(e.target.value)} placeholder="검사한 권수 (예: 2)" className="p-2 border rounded" />
          <input type="number" value={rewardPerBook} onChange={e=>setRewardPerBook(e.target.value)} placeholder={`권당 보상 (예: 500${config.currency})`} className="p-2 border rounded" />
          <div className="p-2 text-sm text-slate-500">학생 옆의 [확인] 버튼을 누르면 즉시 해당 수치가 더해집니다.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {allStudents.map(s => {
             const books = readingData.find(r=>r.studentId === s.id)?.books || 0;
             return (
               <div key={s.id} className="p-4 border rounded-lg bg-white flex justify-between items-center shadow-sm">
                 <div>
                   <p className="font-bold">{s.number} {s.name}</p>
                   <p className="text-sm text-blue-600">누적: {books}권</p>
                 </div>
                 <button onClick={()=>handleAddReading(s.id)} className="px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm">확인</button>
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  const AdminRolesView = () => {
    const handleRoleUpdate = async (roleId, field, value) => {
      const role = rolesData.find(r => r.id === roleId);
      let updated = { ...role, [field]: value };
      if (field === 'studentId') {
        const student = allStudents.find(s => s.id === parseInt(value));
        updated.studentName = student ? student.name : '미배정';
        updated.studentId = parseInt(value);
      }
      await setDoc(getDocRef('rolesData', roleId), updated);
    };

    const addRole = async () => {
      const id = Date.now();
      await setDoc(getDocRef('rolesData', id), { id, dept: '새 부서', role: '역할', studentId: 0, studentName: '미배정', salary: 0 });
    };

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">부서 역할 및 수당 관리</h2>
          <div className="flex space-x-2">
            <button onClick={() => executeRoleSalaryPayment(false)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              <CheckSquare size={16} /> <span>수동 일괄 지급 실행 (테스트용)</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 border-b flex justify-end bg-slate-50">
            <button onClick={addRole} className="text-sm flex items-center space-x-2 bg-slate-200 px-3 py-1.5 rounded hover:bg-slate-300">
              <PlusCircle size={14} /> <span>새 역할 추가</span>
            </button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b">
                <th className="p-4 font-semibold">부서명</th>
                <th className="p-4 font-semibold">담당 역할</th>
                <th className="p-4 font-semibold">담당 학생 배정</th>
                <th className="p-4 font-semibold">주급({config.currency}) 설정</th>
                <th className="p-4 font-semibold text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {rolesData.map((role) => (
                <tr key={role.id} className="border-b hover:bg-slate-50">
                  <td className="p-4"><input type="text" value={role.dept} onChange={e=>handleRoleUpdate(role.id, 'dept', e.target.value)} className="w-24 p-1.5 border rounded text-sm" /></td>
                  <td className="p-4"><input type="text" value={role.role} onChange={e=>handleRoleUpdate(role.id, 'role', e.target.value)} className="w-full p-1.5 border rounded text-sm" /></td>
                  <td className="p-4">
                    <select value={role.studentId} onChange={(e) => handleRoleUpdate(role.id, 'studentId', e.target.value)} className="p-1.5 border rounded text-sm w-32 font-medium text-blue-600">
                      <option value="0">미배정</option>
                      {allStudents.map(s => <option key={s.id} value={s.id}>{s.number} {s.name}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" value={role.salary} onChange={(e) => handleRoleUpdate(role.id, 'salary', parseInt(e.target.value)||0)} className="w-24 p-1.5 border rounded text-sm text-right font-bold" />
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={()=>deleteDoc(getDocRef('rolesData', role.id))} className="text-slate-400 hover:text-red-500 mx-1"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const AdminTransferView = () => {
    const [targetType, setTargetType] = useState('all');
    const [selectedStudents, setSelectedStudents] = useState(allStudents.map(s => s.id));
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [transactionType, setTransactionType] = useState('income');

    const handleExecute = async () => {
      if (!amount || !description || selectedStudents.length === 0) return showMessage('모두 입력해주세요.', 'error');
      const numAmount = parseInt(amount, 10);
      let totalTaxCollected = 0;

      for(const sId of selectedStudents) {
        const student = allStudents.find(s => s.id === sId);
        if(!student) continue;

        let newAsset;
        const txId = Date.now() + Math.random();
        
        if (transactionType === 'income') {
          const tax = Math.floor(numAmount * 0.1);
          const netIncome = numAmount - tax;
          totalTaxCollected += tax;
          newAsset = student.asset + netIncome;

          await setDoc(getDocRef('transactions', txId), {
            id: txId, studentId: student.id, date: new Date().toISOString().split('T')[0], type: '수입',
            desc: description, amount: netIncome, balance: newAsset, note: `세금 ${tax} 징수`
          });
        } else {
          newAsset = student.asset - numAmount;
          await setDoc(getDocRef('transactions', txId), {
            id: txId, studentId: student.id, date: new Date().toISOString().split('T')[0], type: '지출',
            desc: description, amount: numAmount, balance: newAsset, note: '관리자 차감'
          });
        }
        await setDoc(getDocRef('students', student.id), { ...student, asset: newAsset });
      }

      if(totalTaxCollected > 0) {
        await setDoc(getDocRef('settings', 'config'), { ...config, classTax: config.classTax + totalTaxCollected });
      }

      showMessage('일괄 처리 되었습니다.');
      setAmount(''); setDescription('');
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">학생 수입/지출 일괄 관리</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">대상</label>
              <select value={targetType} onChange={(e) => {
                setTargetType(e.target.value);
                setSelectedStudents(e.target.value === 'all' ? allStudents.map(s=>s.id) : []);
              }} className="w-full p-2 border rounded-lg">
                <option value="all">전체 학생</option>
                <option value="individual">개별 선택</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">분류</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="w-full p-2 border rounded-lg">
                <option value="income">수입 지급 (세금10% 자동공제)</option>
                <option value="expense">지출 징수 (벌금 등)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">금액 ({config.currency})</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 5000" className="w-full p-2 border rounded-lg" />
            </div>
          </div>

          {targetType === 'individual' && (
            <div className="mb-4 p-4 border rounded-lg bg-slate-50 flex flex-wrap gap-2">
              {allStudents.map(student => (
                <button key={student.id} onClick={() => setSelectedStudents(prev => prev.includes(student.id) ? prev.filter(id=>id!==student.id) : [...prev, student.id])} 
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${selectedStudents.includes(student.id) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>
                  {student.number} {student.name}
                </button>
              ))}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm text-slate-600 mb-1">내용 (학생 출납부에 표시될 내용)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500" />
          </div>
          
          <div className="flex justify-end">
            <button onClick={handleExecute} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <PlusCircle size={18} /> <span>실행하기</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AdminSettingsView = () => {
    const [tempPlatformName, setTempPlatformName] = useState(config.platformName);
    const [tempCurrency, setTempCurrency] = useState(config.currency);
    const [tempPin, setTempPin] = useState(config.teacherPin);

    const handleSaveSettings = async () => {
      await setDoc(getDocRef('settings', 'config'), { ...config, platformName: tempPlatformName, currency: tempCurrency, teacherPin: tempPin });
      showMessage('플랫폼 기본 설정이 클라우드에 저장되었습니다.');
    };

    const handleFileUpload = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
           const text = event.target.result;
           const rows = text.split('\n');
           let count = 0;
           for(let row of rows) {
             const [num, name] = row.split(',');
             if(num && name && name.trim() !== '') {
               const id = Date.now() + Math.random();
               await setDoc(getDocRef('students', id), { id, number: num.trim(), name: name.trim(), asset: 0, uid: null });
               count++;
             }
           }
           showMessage(`${count}명의 학생 계정이 DB에 생성되었습니다!`);
        };
        reader.readAsText(file);
      }
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">기본 설정 및 명단 관리</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center border-b pb-3"><Sliders className="mr-2 text-slate-500" size={20} /> 플랫폼 기본 정보</h3>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">플랫폼 이름</label>
              <input type="text" value={tempPlatformName} onChange={(e) => setTempPlatformName(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">화폐 단위</label>
              <input type="text" value={tempCurrency} onChange={(e) => setTempCurrency(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-1">관리자 비밀번호 (초기값:0000)</label>
              <input type="password" value={tempPin} onChange={(e) => setTempPin(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <button onClick={handleSaveSettings} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">저장하기</button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center border-b pb-3"><Users className="mr-2 text-slate-500" size={20} /> 명단 업로드 (CSV)</h3>
            <div className="mb-4 bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
              <p>💡 <strong>CSV 업로드 가이드</strong></p>
              <p>엑셀에서 "번호,이름" 형태(예: 1번,김철수)로 작성 후 <strong>.csv 형식</strong>으로 저장하여 업로드하세요. 즉시 DB에 생성됩니다.</p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-pointer relative">
              <UploadCloud size={40} className="text-slate-400 mb-3" />
              <p className="font-semibold text-slate-700">여기를 클릭하여 CSV 파일 업로드</p>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <header className="bg-white p-4 border-b border-slate-200 flex justify-end items-center shadow-sm sticky top-0 z-10 h-16">
          <div className="flex items-center space-x-4">
             <span className="text-sm text-slate-600">학급 누적 국고: <strong className="text-emerald-600">{config.classTax.toLocaleString()} {config.currency}</strong></span>
          </div>
        </header>

        {globalMessage.text && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl font-bold text-center shadow-xl z-50 transition-all duration-300 ${
            globalMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}>
            {globalMessage.text}
          </div>
        )}
        
        <main>
          {activeMenu === 'dashboard' && <DashboardView />}
          {activeMenu === 'store' && <StoreView />}
          {activeMenu === 'reading' && <ReadingView />}
          {activeMenu === 'roles' && <RolesView />}
          {activeMenu === 'admin-assets' && isAdmin && <AdminAssetsView />}
          {activeMenu === 'admin-store' && isAdmin && <AdminStoreView />}
          {activeMenu === 'admin-reading' && isAdmin && <AdminReadingView />}
          {activeMenu === 'admin-roles' && isAdmin && <AdminRolesView />}
          {activeMenu === 'admin-transfer' && isAdmin && <AdminTransferView />}
          {activeMenu === 'admin-settings' && isAdmin && <AdminSettingsView />}
        </main>
      </div>
    </div>
  );
};

export default ClassEconomyApp;