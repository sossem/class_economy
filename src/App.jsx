import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, ShoppingCart, Award, Users, Settings, LogOut, Download, PlusCircle, 
  UserCheck, BookOpen, Medal, ListOrdered, CheckSquare, Edit, Trash2, 
  Briefcase, Calendar, Sliders, CreditCard, UploadCloud, FileSpreadsheet, Lock, Key, Save
} from 'lucide-react';

// Firebase Imports (Cloud DB & Auth)
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, deleteDoc, writeBatch } from "firebase/firestore";

// Firebase Setup
const isCanvas = typeof __firebase_config !== 'undefined';
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

const db = getFirestore(app, "class-economy-2026");


// 로컬 및 실제 배포(Github Pages) 환경에서 사용할 고정 ID
const localAppId = 'class-economy-app';
const activeAppId = isCanvas && typeof __app_id !== 'undefined' ? __app_id.replace(/\//g, '_') : localAppId;

// DB Reference Helpers
const getColRef = (colName) => collection(db, 'artifacts', activeAppId, 'public', 'data', colName);
const getDocRef = (colName, docId) => doc(db, 'artifacts', activeAppId, 'public', 'data', colName, String(docId));

const App = () => {
  // --------------------------------------------------------
  // 1. Firebase Auth & Role State
  // --------------------------------------------------------
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState(null); // 'teacher' | 'student' | null
  
  // 통합 로그인 상태
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // --------------------------------------------------------
  // 2. Global Data States (Synced with Firestore)
  // --------------------------------------------------------
  const [config, setConfig] = useState({ platformName: '우리반 경제 플랫폼', currency: '미소', classTax: 0, teacherId: 'admin', teacherPin: '0000', teacherUid: null, lastAutoPayDate: '' });
  const [allStudents, setAllStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [readingData, setReadingData] = useState([]);
  const [rolesData, setRolesData] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  // --------------------------------------------------------
  // 2-1. 하위 뷰(View) 전용 로컬 상태를 최상단으로 끌어올림 (입력창 포커스 아웃 버그 방지)
  // --------------------------------------------------------
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [globalMessage, setGlobalMessage] = useState({ text: '', type: '' });

  // [대시보드 전용 상태]
  const [txLimit, setTxLimit] = useState(15);

  // [자산 관리 전용 상태]
  const [assetSortType, setAssetSortType] = useState('asset'); // 'asset' or 'number'

  // [상점 관리 탭 상태]
  const [storeTab, setStoreTab] = useState('orders');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItem, setNewItem] = useState({name: '', price: '', stock: ''});

  // [독서 검사 관리 탭 상태]
  const [addedBooks, setAddedBooks] = useState('');
  const [rewardPerBook, setRewardPerBook] = useState('500');

  // [수입/지출 일괄 관리 탭 상태]
  const [targetType, setTargetType] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transactionType, setTransactionType] = useState('income');

  // [기본 설정 탭 상태]
  const [tempPlatformName, setTempPlatformName] = useState('');
  const [tempCurrency, setTempCurrency] = useState('');
  const [tempAdminId, setTempAdminId] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [editTaxValue, setEditTaxValue] = useState(0);

  // 메뉴 변경 시 대시보드 내역 더보기 리셋
  useEffect(() => {
    if (activeMenu !== 'dashboard') setTxLimit(15);
  }, [activeMenu]);

  // DB에서 config 불러오면 설정창 기본값에 반영
  useEffect(() => {
    if (config.platformName) {
      setTempPlatformName(config.platformName);
      setTempCurrency(config.currency);
      setTempAdminId(config.teacherId);
      setTempPin(config.teacherPin);
      setEditTaxValue(config.classTax);
    }
  }, [config]);

  // Current logged in student data (if role === 'student')
  const studentData = allStudents.find(s => s.uid === user?.uid);
  const isAdmin = currentRole === 'teacher';

  const showMessage = (text, type = 'success') => {
    setGlobalMessage({ text, type });
    setTimeout(() => setGlobalMessage({ text: '', type: '' }), type === 'error' ? 6000 : 4000);
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
        console.error("Auth Error: " + err.message);
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

    // Database Seeder
    const checkAndSeedDB = async () => {
      try {
        const configSnap = await getDoc(getDocRef('settings', 'config'));
        if (!configSnap.exists()) {
          console.log("Seeding initial database...");
          await setDoc(getDocRef('settings', 'config'), { 
            platformName: '우리반 경제 플랫폼', currency: '미소', classTax: 4500, teacherId: 'admin', teacherPin: '0000', teacherUid: null, lastAutoPayDate: '' 
          });
        }
      } catch (err) {
        console.error("Database seeding error: " + err.message);
      }
    };
    checkAndSeedDB();

    // Setup Realtime Listeners
    const unsubs = [];
    const subscribe = (colName, setter) => {
      unsubs.push(onSnapshot(getColRef(colName), (snap) => {
        const data = snap.docs.map(d => ({...d.data(), _id: d.id}));
        setter(data.sort((a, b) => a.id - b.id));
      }, (err) => console.error(`Err listening to ${colName}: ` + err.message)));
    };

    unsubs.push(onSnapshot(getDocRef('settings', 'config'), (snap) => {
      if(snap.exists()) {
        const conf = snap.data();
        if(!conf.teacherId) conf.teacherId = 'admin';
        setConfig(conf);
      }
    }, (err) => console.error(`Err listening to config: ` + err.message)));

    subscribe('students', (data) => {
      setAllStudents(data);
    });

    // 최근 거래 내역 시간 역순 정렬 (ID 앞부분이 timestamp인 것을 활용)
    unsubs.push(onSnapshot(getColRef('transactions'), (snap) => {
      const data = snap.docs.map(d => ({...d.data(), _id: d.id}));
      setTransactions(data.sort((a, b) => {
        const timeA = parseInt(String(a.id).split('_')[0]) || 0;
        const timeB = parseInt(String(b.id).split('_')[0]) || 0;
        return timeB - timeA;
      }));
    }, (err) => console.error(`Err listening to transactions: ` + err.message)));

    // 주문 관리 최신순 정렬
    unsubs.push(onSnapshot(getColRef('purchaseHistory'), (snap) => {
      const data = snap.docs.map(d => ({...d.data(), _id: d.id}));
      setPurchaseHistory(data.sort((a, b) => {
        const timeA = parseInt(String(a.id).split('_')[0]) || 0;
        const timeB = parseInt(String(b.id).split('_')[0]) || 0;
        return timeB - timeA;
      }));
    }, (err) => console.error(`Err listening to purchaseHistory: ` + err.message)));

    subscribe('storeItems', setStoreItems);
    subscribe('readingData', setReadingData);
    subscribe('rolesData', setRolesData);

    return () => unsubs.forEach(fn => fn());
  }, [user]);

  // --------------------------------------------------------
  // 4. Action Handlers (Writing to DB)
  // --------------------------------------------------------
  
  // 금요일 자동 지급
  useEffect(() => {
    const checkAutoPay = async () => {
      if (currentRole === 'teacher' && config.platformName) {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        
        if (today.getDay() === 5 && config.lastAutoPayDate !== dateString) {
          await setDoc(getDocRef('settings', 'config'), { ...config, lastAutoPayDate: dateString });
          executeRoleSalaryPayment(true);
        }
      }
    };
    checkAutoPay();
  }, [currentRole, config]);

  const executeRoleSalaryPayment = async (isAuto = false) => {
    try {
      const batch = writeBatch(db);
      let totalTaxCollected = 0;
      let appliedCount = 0;
      
      allStudents.forEach((student) => {
        const studentRole = rolesData.find(r => r.studentId === student.id);
        if (studentRole && studentRole.salary > 0) {
          const tax = Math.floor(studentRole.salary * 0.1);
          const netIncome = studentRole.salary - tax;
          totalTaxCollected += tax;
          const currentAsset = Number(student.asset) || 0;
          
          batch.set(getDocRef('students', student.id), { asset: currentAsset + netIncome }, { merge: true });
          
          const txId = Date.now().toString() + '_tx_' + student.id;
          batch.set(getDocRef('transactions', txId), {
            id: txId, studentId: student.id, date: new Date().toISOString().split('T')[0], type: '수입',
            desc: `[${studentRole.dept}] ${studentRole.role} 주급 ${isAuto ? '(자동지급)' : ''}`, amount: netIncome, balance: currentAsset + netIncome, note: `세금 ${tax} 징수`
          });
          appliedCount++;
        }
      });

      if (appliedCount > 0) {
        if (totalTaxCollected > 0) {
          batch.set(getDocRef('settings', 'config'), { classTax: Number(config.classTax) + totalTaxCollected }, { merge: true });
        }
        await batch.commit();
        showMessage(isAuto ? `🎉 금요일 부서 역할 수당이 자동 지급되었습니다. (${appliedCount}명)` : `부서 역할 수당 일괄 지급이 완료되었습니다. (${appliedCount}명)`);
      } else {
        showMessage('지급할 부서 역할 수당이 없습니다.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMessage('일괄 지급 처리 중 오류가 발생했습니다.', 'error');
    }
  };

  const handlePurchase = async (item) => {
    if ((studentData?.asset || 0) < item.price) return showMessage('잔액이 부족합니다.', 'error');
    if (item.stock <= 0) return showMessage('재고가 모두 소진되었습니다.', 'error');

    const newAsset = (studentData?.asset || 0) - item.price;
    const today = new Date().toISOString().split('T')[0];
    const newTxId = Date.now().toString();

    const batch = writeBatch(db);
    batch.set(getDocRef('students', studentData.id), { asset: newAsset }, { merge: true });
    batch.set(getDocRef('storeItems', item.id), { stock: item.stock - 1 }, { merge: true });
    batch.set(getDocRef('transactions', newTxId), {
      id: newTxId, studentId: studentData.id, date: today, type: '지출', 
      desc: `상점 - ${item.name} 구매`, amount: item.price, balance: newAsset, note: '대기'
    });
    batch.set(getDocRef('purchaseHistory', newTxId), {
      id: newTxId, studentId: studentData.id, date: today, student: `${studentData.number} ${studentData.name}`, item: item.name, status: '대기'
    });

    await batch.commit();
    showMessage(`${item.name} 구매가 완료되었습니다!`);
  };

  // 통합 로그인 처리 핸들러
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanId = loginId.trim();

    if (!cleanId || !loginPw) {
      return showMessage('아이디와 비밀번호를 모두 입력해주세요.', 'error');
    }

    try {
      // 1. 관리자 확인
      const adminId = config.teacherId || 'admin';
      if (cleanId === adminId && loginPw === config.teacherPin) {
        await setDoc(getDocRef('settings', 'config'), { ...config, teacherUid: user.uid });
        setCurrentRole('teacher');
        showMessage('관리자 계정으로 접속되었습니다.');
        return;
      }

      // 2. 학생 확인 (이름 또는 번호로 검색)
      const student = allStudents.find(s => s.name === cleanId || s.number === cleanId || String(s.id) === cleanId);
      
      if (student && loginPw === '1234') { // 학생 기본 비번 1234
        if (student.uid && student.uid !== user.uid) {
          showMessage('이미 다른 기기에서 연결된 계정입니다. 선생님께 초기화를 요청하세요.', 'error');
          return;
        }
        await setDoc(getDocRef('students', student.id), { ...student, uid: user.uid });
        setCurrentRole('student');
        showMessage(`${student.name} 학생 반가워요!`);
        return;
      }

      showMessage('아이디 또는 비밀번호가 올바르지 않습니다.', 'error');
    } catch (err) {
      console.error(err);
      showMessage(`로그인 실패: 파이어베이스 연결 오류 (${err.message})`, 'error');
    }
  };

  const handleLogout = async () => {
  try {
    if (currentRole === 'teacher') {
      await setDoc(getDocRef('settings', 'config'), { teacherUid: null }, { merge: true });
    } else if (currentRole === 'student' && studentData) {
      await setDoc(getDocRef('students', studentData.id), { uid: null }, { merge: true });
    }
  } catch (err) {
    console.error('Logout cleanup error: ' + err.message);
  }
  setCurrentRole(null);
  setLoginId('');
  setLoginPw('');
};



  // --------------------------------------------------------
  // 5. Auth / Loading Views
  // --------------------------------------------------------
  if (authLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-slate-50"><p className="text-xl font-bold text-slate-400 animate-pulse">데이터베이스 연결 중...</p></div>;
  }

  // 통합 로그인 화면
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
        <form onSubmit={handleLoginSubmit} className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{config.platformName}</h1>
          <p className="text-slate-500 mb-8 text-sm">아이디와 비밀번호를 입력해주세요.</p>

          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1 ml-1">아이디 (학생은 이름)</label>
              <input 
                type="text" 
                value={loginId} 
                onChange={e=>setLoginId(e.target.value)} 
                placeholder="예: admin 또는 김철수" 
                className="w-full p-4 border border-slate-300 rounded-xl focus:outline-blue-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1 ml-1">비밀번호</label>
              <input 
                type="password" 
                value={loginPw} 
                onChange={e=>setLoginPw(e.target.value)} 
                placeholder="비밀번호 입력" 
                className="w-full p-4 border border-slate-300 rounded-xl focus:outline-blue-500 tracking-widest font-mono" 
              />
            </div>
            
            <button type="submit" className="w-full py-4 mt-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
              로그인
            </button>
          </div>

          <div className="mt-6 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg text-left">
            <p><strong>[로그인 안내]</strong></p>
            <p className="mt-1">👨‍🏫 관리자: <strong>{config.teacherId}</strong> / <strong>{config.teacherPin}</strong></p>
            <p>🧑‍🎓 학생: <strong>본인이름</strong> / <strong>1234</strong> (기본값)</p>
          </div>
        </form>
      </div>
    );
  }

  // --------------------------------------------------------
  // 6. Main App UI Components (Render Functions)
  // --------------------------------------------------------
  
  const myTransactions = transactions.filter(tx => tx.studentId === studentData?.id);

  const renderSidebar = () => (
    <div className="w-64 bg-slate-800 text-white flex flex-col min-h-screen shrink-0">
      <div className="p-5 text-xl font-bold border-b border-slate-700 flex justify-between items-center">
        <span>{config.platformName}</span>
      </div>
      <div className="p-4 flex items-center space-x-3 border-b border-slate-700">
        <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center shrink-0">
          <UserCheck size={20} />
        </div>
        <div className="overflow-hidden">
          <p className="text-sm text-slate-300 truncate">{isAdmin ? '관리자 (선생님)' : `${studentData?.number || ''} ${studentData?.name || ''}`}</p>
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

  const renderDashboardView = () => {
    const targetTransactions = isAdmin ? transactions : myTransactions;
    const displayedTxs = targetTransactions.slice(0, txLimit);

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">자산 요약</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500 mb-1">나의 현재 자산</p>
            <div className="text-3xl font-bold text-blue-600">{isAdmin ? '-' : (studentData?.asset || 0).toLocaleString()} {config.currency}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500 mb-1">학급 누적 세금 (국고)</p>
            <div className="text-3xl font-bold text-emerald-600">{(config.classTax || 0).toLocaleString()} {config.currency}</div>
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
              {displayedTxs.map((tx) => (
                <tr key={tx.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 text-slate-600">{tx.date}</td>
                  {isAdmin && <td className="p-4 font-medium">{allStudents.find(s=>s.id===tx.studentId)?.name || '알수없음'}</td>}
                  <td className="p-4">{tx.desc}</td>
                  <td className="p-4 text-right text-blue-600 font-medium">{tx.type === '수입' ? `+${(tx.amount || 0).toLocaleString()}` : '-'}</td>
                  <td className="p-4 text-right text-red-500 font-medium">{tx.type === '지출' ? `${(tx.amount || 0).toLocaleString()}` : '-'}</td>
                  <td className="p-4 text-right font-bold">{(tx.balance || 0).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    {tx.note === '수령완료' ? (
                      <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-medium">수령완료</span>
                    ) : <span className="text-xs text-slate-500">{tx.note}</span>}
                  </td>
                </tr>
              ))}
              {targetTransactions.length === 0 && (
                <tr><td colSpan={isAdmin?7:6} className="p-8 text-center text-slate-400">거래 내역이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
          {targetTransactions.length > txLimit && (
            <div className="p-4 bg-slate-50 border-t text-center">
              <button onClick={() => setTxLimit(prev => prev + 15)} className="text-blue-600 text-sm font-bold hover:underline">거래 내역 더보기 ▼</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStoreView = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">학급 상점</h2>
        <div className="text-lg font-semibold text-slate-700 bg-white px-4 py-2 rounded-lg border shadow-sm">
          내 잔액: <span className="text-blue-600">{isAdmin ? '-' : (studentData?.asset || 0).toLocaleString()} {config.currency}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {storeItems.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="h-32 bg-slate-100 rounded-lg mb-4 flex items-center justify-center">
              <ShoppingCart size={40} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold mb-2">{item.name}</h3>
            <p className="text-2xl font-bold text-blue-600 mb-4">{(item.price || 0).toLocaleString()} {config.currency}</p>
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

  const renderReadingView = () => {
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

  const renderRolesView = () => (
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
                <td className="p-4 text-right font-bold">{(role.salary || 0).toLocaleString()}</td>
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
  const renderAdminAssetsView = () => {
    // 정렬 로직 및 등수 계산 적용
    const sortedByAssetForRank = [...allStudents].sort((a,b) => b.asset - a.asset);
    const getRank = (studentId) => sortedByAssetForRank.findIndex(s => s.id === studentId) + 1;
    
    const sortedStudents = [...allStudents].sort((a, b) => {
      if (assetSortType === 'asset') return b.asset - a.asset;
      return a.id - b.id; // 번호순(ID가 고유 번호기반이므로 ID 정렬 활용)
    });

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">전체 학생 자산 관리</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <span className="text-sm font-semibold text-slate-600">총 인원: {allStudents.length}명</span>
            <div className="flex space-x-2">
              <button onClick={() => setAssetSortType('number')} className={`px-3 py-1 text-xs rounded transition ${assetSortType === 'number' ? 'bg-slate-800 text-white font-bold' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>번호순 정렬</button>
              <button onClick={() => setAssetSortType('asset')} className={`px-3 py-1 text-xs rounded transition ${assetSortType === 'asset' ? 'bg-slate-800 text-white font-bold' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>자산총액순 정렬</button>
            </div>
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
              {sortedStudents.map((s) => (
                <tr key={s.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 text-slate-600">{s.number}</td>
                  <td className="p-4 font-bold">{s.name}</td>
                  <td className="p-4 text-right text-blue-600 font-bold">{(s.asset || 0).toLocaleString()}</td>
                  <td className="p-4 text-center text-slate-500 font-medium">{getRank(s.id)}위</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAdminStoreView = () => {
    const handleBulkComplete = async () => {
      if (selectedOrders.length === 0) return;
      const batch = writeBatch(db);

      for(const id of selectedOrders) {
        const order = purchaseHistory.find(o => o.id === id);
        if(order) {
           batch.set(getDocRef('purchaseHistory', id), { status: '완료' }, { merge: true });
           batch.set(getDocRef('transactions', id), { note: '수령완료' }, { merge: true });
        }
      }
      await batch.commit();
      setSelectedOrders([]);
      showMessage('일괄 배부 처리 되었습니다.');
    };

    const toggleSelectAll = (e) => {
      if (e.target.checked) setSelectedOrders(purchaseHistory.filter(o => o.status === '대기').map(o => o.id));
      else setSelectedOrders([]);
    };

    const handleAddNewItem = () => {
      if(newItem.name && newItem.price && newItem.stock) {
        const id = Date.now().toString();
        setDoc(getDocRef('storeItems', id), { id, name: newItem.name, price: parseInt(newItem.price), stock: parseInt(newItem.stock) });
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
          <button onClick={() => setStoreTab('orders')} className={`px-4 py-2 rounded-lg font-semibold transition ${storeTab === 'orders' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>학생 구매 내역 (배부 처리)</button>
          <button onClick={() => setStoreTab('items')} className={`px-4 py-2 rounded-lg font-semibold transition ${storeTab === 'items' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>판매 상품 관리</button>
        </div>

        {storeTab === 'orders' && (
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

        {storeTab === 'items' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b flex justify-end bg-slate-50">
              <button onClick={() => setShowNewItemForm(!showNewItemForm)} className="text-sm flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                <PlusCircle size={14} /> <span>새 상품 등록</span>
              </button>
            </div>
            
            {/* 새 상품 등록 인라인 폼 */}
            {showNewItemForm && (
              <div className="p-4 bg-blue-50 border-b flex flex-wrap gap-2 items-center">
                <input type="text" placeholder="상품명" value={newItem.name} onChange={e=>setNewItem({...newItem, name: e.target.value})} className="p-2 border rounded text-sm flex-1 focus:outline-blue-500" />
                <input type="number" placeholder="가격 (숫자만)" value={newItem.price} onChange={e=>setNewItem({...newItem, price: e.target.value})} className="p-2 border rounded text-sm w-32 focus:outline-blue-500" />
                <input type="number" placeholder="수량" value={newItem.stock} onChange={e=>setNewItem({...newItem, stock: e.target.value})} className="p-2 border rounded text-sm w-24 focus:outline-blue-500" />
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
                    <td className="p-4 text-right text-blue-600 font-medium">{(item.price || 0).toLocaleString()}</td>
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

  const renderAdminReadingView = () => {
    // 개별 지급 로직
    const handleAddReading = async (studentId) => {
      if(!addedBooks) return showMessage("권수를 입력하세요", "error");
      const numBooks = parseInt(addedBooks);
      const reward = numBooks * parseInt(rewardPerBook || 0);
      
      const currentRec = readingData.find(r => r.studentId === studentId);
      const student = allStudents.find(s => s.id === studentId);

      if(!student) return showMessage("학생 정보를 찾을 수 없습니다.", "error");

      try {
        const batch = writeBatch(db);

        // 1. Update reading count
        if(currentRec) {
          batch.set(getDocRef('readingData', currentRec.id), { books: currentRec.books + numBooks }, { merge: true });
        } else {
          const newId = Date.now().toString() + '_' + studentId;
          batch.set(getDocRef('readingData', newId), { id: newId, studentId, name: student.name, books: numBooks });
        }
        
        // 2. Add reward transaction if applicable
        if (reward > 0) {
          const tax = Math.floor(reward * 0.1);
          const netIncome = reward - tax;
          const currentAsset = Number(student.asset) || 0;

          batch.set(getDocRef('students', studentId), { asset: currentAsset + netIncome }, { merge: true });
          batch.set(getDocRef('settings', 'config'), { classTax: Number(config.classTax) + tax }, { merge: true });
          
          const txId = Date.now().toString() + '_tx_' + studentId;
          batch.set(getDocRef('transactions', txId), {
            id: txId, studentId, date: new Date().toISOString().split('T')[0], type: '수입',
            desc: `독서기록장 ${numBooks}권 달성 보상`, amount: netIncome, balance: currentAsset + netIncome, note: `세금 ${tax} 징수`
          });
        }
        
        await batch.commit();
        showMessage(`${student.name} 학생의 독서량과 수당이 반영되었습니다.`);
      } catch(err) {
        console.error(err);
        showMessage("독서 수당 개별 지급 오류", "error");
      }
    };

    // 전체 일괄 지급 로직 추가
    const handleBatchAddReading = async () => {
      if(!addedBooks) return showMessage("권수를 입력하세요", "error");
      if(allStudents.length === 0) return showMessage("등록된 학생이 없습니다.", "error");

      const numBooks = parseInt(addedBooks);
      const reward = numBooks * parseInt(rewardPerBook || 0);
      
      let totalTaxCollected = 0;
      const today = new Date().toISOString().split('T')[0];

      try {
        const batch = writeBatch(db);

        allStudents.forEach((student) => {
          const currentRec = readingData.find(r => r.studentId === student.id);
          
          if(currentRec) {
            batch.set(getDocRef('readingData', currentRec.id), { books: currentRec.books + numBooks }, { merge: true });
          } else {
            const newId = Date.now().toString() + '_rd_' + student.id;
            batch.set(getDocRef('readingData', newId), { id: newId, studentId: student.id, name: student.name, books: numBooks });
          }

          if (reward > 0) {
            const tax = Math.floor(reward * 0.1);
            const netIncome = reward - tax;
            totalTaxCollected += tax;
            const currentAsset = Number(student.asset) || 0;

            batch.set(getDocRef('students', student.id), { asset: currentAsset + netIncome }, { merge: true });
            
            const txId = Date.now().toString() + '_tx_' + student.id;
            batch.set(getDocRef('transactions', txId), {
              id: txId, studentId: student.id, date: today, type: '수입',
              desc: `독서기록장 ${numBooks}권 달성 보상 (일괄)`, amount: netIncome, balance: currentAsset + netIncome, note: `세금 ${tax} 징수`
            });
          }
        });

        if (totalTaxCollected > 0) {
          batch.set(getDocRef('settings', 'config'), { classTax: Number(config.classTax) + totalTaxCollected }, { merge: true });
        }

        await batch.commit();
        showMessage(`모든 학생에게 독서량(${numBooks}권)과 수당이 일괄 지급되었습니다!`);
      } catch(err) {
        console.error(err);
        showMessage("독서 수당 일괄 지급 오류", "error");
      }
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">독서량 검사 및 수당 지급</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <input type="number" value={addedBooks} onChange={e=>setAddedBooks(e.target.value)} placeholder="검사한 권수 (예: 2)" className="p-2 border rounded w-40 focus:outline-blue-500" />
            <input type="number" value={rewardPerBook} onChange={e=>setRewardPerBook(e.target.value)} placeholder={`권당 보상 (예: 500)`} className="p-2 border rounded w-40 focus:outline-blue-500" />
            <div className="p-2 text-sm text-slate-500">학생 개별 [확인] 또는 [전체 일괄 지급] 선택</div>
          </div>
          <button onClick={handleBatchAddReading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold shadow-sm whitespace-nowrap">
            전체 학생 일괄 지급
          </button>
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

  const renderAdminRolesView = () => {
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
      const id = Date.now().toString();
      await setDoc(getDocRef('rolesData', id), { id, dept: '새 부서', role: '역할', studentId: 0, studentName: '미배정', salary: 0 });
    };

    const handleRolesExcelUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      showMessage('역할 엑셀 파일을 분석 중입니다...', 'success');

      try {
        const XLSX = await import('https://esm.sh/xlsx');
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const buffer = evt.target.result;
            let rows = [];

            // CSV 파일 파싱 지원
            if (file.name.toLowerCase().endsWith('.csv')) {
              let text = new TextDecoder('utf-8').decode(buffer);
              if (text.includes('\uFFFD')) {
                text = new TextDecoder('euc-kr').decode(buffer);
              }
              const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
              if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => h.replace(/["\uFEFF\u200B]/g, '').trim());
                for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
                  const rowObj = {};
                  headers.forEach((h, idx) => rowObj[h] = values[idx] || '');
                  rows.push(rowObj);
                }
              }
            } else {
              const workbook = XLSX.read(buffer, { type: 'array' });
              const sheet = workbook.Sheets[workbook.SheetNames[0]];
              rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            }

            if (rows.length === 0) {
              return showMessage('파일에 데이터가 없습니다.', 'error');
            }

            let count = 0;
            const batch = writeBatch(db);

            rows.forEach((row, i) => {
              const normRow = {};
              for (let key in row) {
                if (key) normRow[key.replace(/[\s\uFEFF\u200B]/g, '')] = row[key];
              }

              const dept = normRow['부서명'] || normRow['부서'];
              const roleName = normRow['담당역할'] || normRow['역할'];
              const studentName = normRow['이름'] || normRow['담당학생'];
              const salaryText = normRow['주급'] || normRow['수당'] || normRow['월급'] || 0;
              const salary = parseInt(String(salaryText).replace(/[^0-9]/g, '')) || 0;

              if (dept && roleName) {
                let stId = 0;
                let stName = '미배정';
                
                if (studentName) {
                  const student = allStudents.find(s => s.name === String(studentName).trim() || s.number === String(studentName).trim());
                  if (student) {
                    stId = student.id;
                    stName = student.name;
                  }
                }

                const roleId = Date.now().toString() + '_role_' + i;
                batch.set(getDocRef('rolesData', roleId), {
                  id: roleId, dept, role: roleName, studentId: stId, studentName: stName, salary
                });
                count++;
              }
            });

            await batch.commit();
            showMessage(`총 ${count}개의 부서/역할이 성공적으로 일괄 등록되었습니다!`);

          } catch (err) {
            console.error(err);
            showMessage('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'error');
          } finally {
            if (e.target) e.target.value = '';
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        showMessage('엑셀 모듈을 불러오지 못했습니다.', 'error');
        if (e.target) e.target.value = '';
      }
    };

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">부서 역할 및 수당 관리</h2>
          <div className="flex space-x-2">
            <button onClick={() => executeRoleSalaryPayment(false)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm shadow-sm">
              <CheckSquare size={16} /> <span>수동 일괄 지급 실행</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <div className="flex items-center relative">
              <label className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-sm cursor-pointer shadow-sm">
                <FileSpreadsheet size={16} /> <span>엑셀 일괄 등록 (.csv, .xlsx)</span>
                <input type="file" accept=".xls, .xlsx, .csv" onChange={handleRolesExcelUpload} onClick={(e) => { e.target.value = null; }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
              <span className="text-xs text-slate-400 ml-3 hidden md:inline">※ 헤더: 부서명, 담당역할, 이름, 주급</span>
            </div>
            <button onClick={addRole} className="text-sm flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700 shadow-sm">
              <PlusCircle size={14} /> <span>새 역할 1개 추가</span>
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
                  <td className="p-4"><input type="text" value={role.dept} onChange={e=>handleRoleUpdate(role.id, 'dept', e.target.value)} className="w-32 p-1.5 border rounded text-sm focus:outline-blue-500" /></td>
                  <td className="p-4"><input type="text" value={role.role} onChange={e=>handleRoleUpdate(role.id, 'role', e.target.value)} className="w-full p-1.5 border rounded text-sm focus:outline-blue-500" /></td>
                  <td className="p-4">
                    <select value={role.studentId} onChange={(e) => handleRoleUpdate(role.id, 'studentId', e.target.value)} className="p-1.5 border rounded text-sm w-32 font-medium text-blue-600 focus:outline-blue-500">
                      <option value="0">미배정</option>
                      {allStudents.map(s => <option key={s.id} value={s.id}>{s.number} {s.name}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" value={role.salary} onChange={(e) => handleRoleUpdate(role.id, 'salary', parseInt(e.target.value)||0)} className="w-24 p-1.5 border rounded text-sm text-right font-bold focus:outline-blue-500" />
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={()=>deleteDoc(getDocRef('rolesData', role.id))} className="text-slate-400 hover:text-red-500 mx-1"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {rolesData.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">등록된 역할이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAdminTransferView = () => {
    const handleExecute = async () => {
      // "전체 학생" 옵션일 경우 모든 학생의 ID를 대상으로 설정
      const targets = targetType === 'all' ? allStudents.map(s => s.id) : selectedStudents;

      if (!transferAmount || !transferDesc || targets.length === 0) return showMessage('입력값과 대상을 모두 확인해주세요.', 'error');
      
      const numAmount = parseInt(transferAmount, 10);
      let totalTaxCollected = 0;

      try {
        const batch = writeBatch(db);
        const today = new Date().toISOString().split('T')[0];

        targets.forEach((sId) => {
          const student = allStudents.find(s => s.id === sId);
          if(!student) return;

          let newAsset;
          const currentAsset = Number(student.asset) || 0;
          // ID 중복 방지를 위한 랜덤 문자열 추가
          const txId = Date.now().toString() + '_' + student.id + '_' + Math.random().toString(36).substr(2, 9);
          
          if (transactionType === 'income') {
            const tax = Math.floor(numAmount * 0.1);
            const netIncome = numAmount - tax;
            totalTaxCollected += tax;
            newAsset = currentAsset + netIncome;

            batch.set(getDocRef('transactions', txId), {
              id: txId, studentId: student.id, date: today, type: '수입',
              desc: transferDesc, amount: netIncome, balance: newAsset, note: `세금 ${tax} 징수`
            });
          } else {
            newAsset = currentAsset - numAmount;
            batch.set(getDocRef('transactions', txId), {
              id: txId, studentId: student.id, date: today, type: '지출',
              desc: transferDesc, amount: numAmount, balance: newAsset, note: '관리자 차감'
            });
          }
          batch.set(getDocRef('students', student.id), { asset: newAsset }, { merge: true });
        });

        if(totalTaxCollected > 0) {
          batch.set(getDocRef('settings', 'config'), { classTax: Number(config.classTax) + totalTaxCollected }, { merge: true });
        }

        await batch.commit();
        showMessage(`총 ${targets.length}명의 대상에게 일괄 처리 되었습니다.`);
        setTransferAmount(''); setTransferDesc('');
      } catch(err) {
        console.error(err);
        showMessage('일괄 처리 중 오류가 발생했습니다.', 'error');
      }
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
              }} className="w-full p-2 border rounded-lg focus:outline-blue-500">
                <option value="all">전체 학생</option>
                <option value="individual">개별 선택</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">분류</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500">
                <option value="income">수입 지급 (세금10% 자동공제)</option>
                <option value="expense">지출 징수 (벌금 등)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">금액 ({config.currency})</label>
              <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="예: 5000" className="w-full p-2 border rounded-lg focus:outline-blue-500" />
            </div>
          </div>

          {targetType === 'individual' && (
            <div className="mb-4 p-4 border rounded-lg bg-slate-50 flex flex-wrap gap-2">
              {allStudents.map(student => (
                <button key={student.id} onClick={() => setSelectedStudents(prev => prev.includes(student.id) ? prev.filter(id=>id!==student.id) : [...prev, student.id])} 
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${selectedStudents.includes(student.id) ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600'}`}>
                  {student.number} {student.name}
                </button>
              ))}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm text-slate-600 mb-1">내용 (학생 출납부에 표시될 내용)</label>
            <input type="text" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500" />
          </div>
          
          <div className="flex justify-end">
            <button onClick={handleExecute} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 font-bold shadow-sm">
              <PlusCircle size={18} /> <span>실행하기</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminSettingsView = () => {
    const handleSaveSettings = async () => {
      await setDoc(getDocRef('settings', 'config'), { 
        ...config, 
        platformName: tempPlatformName, 
        currency: tempCurrency, 
        teacherId: tempAdminId, 
        teacherPin: tempPin 
      });
      showMessage('플랫폼 기본 설정이 클라우드에 저장되었습니다.');
    };

    const handleUpdateTax = async () => {
      await setDoc(getDocRef('settings', 'config'), { ...config, classTax: Number(editTaxValue) });
      showMessage('학급 국고(세금) 잔액이 수정되었습니다.');
    };

    // 엑셀(.xls, .xlsx, .csv) 파싱 및 업로드 (동적 임포트 및 파이어베이스 Batch 적용)
    const handleExcelUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      showMessage('파일을 분석 및 업로드 중입니다. 잠시만 기다려주세요...', 'success');

      try {
        const XLSX = await import('https://esm.sh/xlsx');
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const buffer = evt.target.result;
            let rows = [];

            // CSV 직접 파싱 (깨짐 및 병합 방지)
            if (file.name.toLowerCase().endsWith('.csv')) {
              let text = new TextDecoder('utf-8').decode(buffer);
              if (text.includes('\uFFFD')) {
                text = new TextDecoder('euc-kr').decode(buffer);
              }
              const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
              if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => h.replace(/["\uFEFF\u200B]/g, '').trim());
                for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
                  const rowObj = {};
                  headers.forEach((h, idx) => rowObj[h] = values[idx] || '');
                  rows.push(rowObj);
                }
              }
            } else {
              const workbook = XLSX.read(buffer, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
            }

            if (rows.length === 0) {
              showMessage('파일에 데이터가 없거나 양식이 잘못되었습니다.', 'error');
              return;
            }

            let count = 0;
            let failCount = 0;
            let lastError = '';

            const batch = writeBatch(db);

            rows.forEach((row, i) => {
              const normRow = {};
              for (let key in row) {
                if (key !== undefined && key !== null) {
                  const cleanKey = String(key).replace(/[\s\uFEFF\u200B]/g, '');
                  normRow[cleanKey] = row[key];
                }
              }

              const studentId = normRow['번호'] || normRow['id'] || normRow['ID'] || normRow['학번'];
              const studentName = normRow['이름'] || normRow['name'] || normRow['Name'] || normRow['성명'];
              let studentAsset = normRow['자산'] || normRow['asset'] || normRow['Asset'] || normRow['금액'];

              if (studentAsset === undefined || studentAsset === null || studentAsset === '') {
                  studentAsset = 0;
              }

              if (studentId !== undefined && studentName !== undefined && String(studentId).trim() !== '' && String(studentName).trim() !== '') {
                try {
                  const parsedId = parseInt(String(studentId).replace(/[^0-9]/g, '')) || (Date.now() + i);
                  const finalNumber = String(studentId).includes('번') ? String(studentId).trim() : `${String(studentId).trim()}번`;

                  if (typeof studentAsset === 'string') {
                    studentAsset = parseInt(studentAsset.replace(/[^0-9-]/g, '')) || 0;
                  } else {
                    studentAsset = Number(studentAsset) || 0;
                  }

                  batch.set(getDocRef('students', parsedId), {
                    id: parsedId,
                    number: finalNumber,
                    name: String(studentName).trim(),
                    asset: studentAsset,
                    uid: null
                  });
                  count++;
                } catch (dbErr) {
                  failCount++;
                  lastError = dbErr.message;
                }
              } else {
                failCount++;
                lastError = "필수 항목(번호, 이름) 누락 데이터 발견";
              }
            });

            await batch.commit();

            if (count > 0 && failCount === 0) {
              showMessage(`총 ${count}명의 학생 명단이 성공적으로 등록되었습니다!`);
            } else if (count > 0 && failCount > 0) {
              showMessage(`${count}명 성공, ${failCount}명 실패. (사유: ${lastError})`, 'error');
            } else {
              showMessage(`업로드 실패 사유: ${lastError}`, 'error');
            }

          } catch (err) {
            console.error("File processing error: ", err);
            showMessage(`파일 분석 오류: 엑셀 양식을 다시 확인해주세요.`, 'error');
          } finally {
            if (e.target) e.target.value = '';
          }
        };

        reader.onerror = () => {
          showMessage(`파일 읽기 실패: ${reader.error.message}`, 'error');
          if (e.target) e.target.value = '';
        };

        reader.readAsArrayBuffer(file);
      } catch (err) {
        showMessage(`엑셀 파싱 도구를 불러오는데 실패했습니다. 네트워크를 확인해주세요.`, 'error');
        if (e.target) e.target.value = '';
      }
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">기본 설정 및 명단 관리</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* 플랫폼 기본 정보 세팅 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center border-b pb-3"><Sliders className="mr-2 text-slate-500" size={20} /> 플랫폼 기본 정보</h3>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">플랫폼 이름</label>
              <input type="text" value={tempPlatformName} onChange={(e) => setTempPlatformName(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">화폐 단위</label>
              <input type="text" value={tempCurrency} onChange={(e) => setTempCurrency(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">관리자 아이디</label>
              <input type="text" value={tempAdminId} onChange={(e) => setTempAdminId(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-1">관리자 비밀번호</label>
              <input type="password" value={tempPin} onChange={(e) => setTempPin(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-blue-500" />
            </div>
            <button onClick={handleSaveSettings} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm">저장하기</button>
          </div>

          {/* 명단 및 국고 관리 */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold mb-4 flex items-center border-b pb-3"><CreditCard className="mr-2 text-slate-500" size={20} /> 학급 국고 잔액 수정</h3>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  className="flex-1 border p-2 rounded-lg focus:outline-blue-500"
                  value={editTaxValue}
                  onChange={(e) => setEditTaxValue(e.target.value)}
                />
                <button onClick={handleUpdateTax} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-sm hover:bg-blue-700">
                  <Save size={18}/> 저장
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold mb-4 flex items-center border-b pb-3"><Users className="mr-2 text-slate-500" size={20} /> 학생 명단 엑셀 업로드 (.xls, .xlsx, .csv)</h3>
              <div className="mb-4 bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                <p>💡 <strong>엑셀 업로드 가이드</strong></p>
                <p>첫 번째 줄(헤더)에 <strong>번호</strong>, <strong>이름</strong>, <strong>자산</strong> 글자가 포함되어 있어야 합니다.</p>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-pointer relative transition-colors">
                <UploadCloud size={40} className="text-blue-500 mb-3" />
                <p className="font-semibold text-slate-700">여기를 클릭하여 엑셀/CSV 파일 업로드</p>
                <input type="file" accept=".xls, .xlsx, .csv" onClick={(e) => { e.target.value = null; }} onChange={handleExcelUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      {renderSidebar()}
      <div className="flex-1 overflow-auto">
        <header className="bg-white p-4 border-b border-slate-200 flex justify-end items-center shadow-sm sticky top-0 z-10 h-16">
          <div className="flex items-center space-x-4">
             <span className="text-sm text-slate-600">학급 누적 국고: <strong className="text-emerald-600">{(config.classTax || 0).toLocaleString()} {config.currency}</strong></span>
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
          {activeMenu === 'dashboard' && renderDashboardView()}
          {activeMenu === 'store' && renderStoreView()}
          {activeMenu === 'reading' && renderReadingView()}
          {activeMenu === 'roles' && renderRolesView()}
          {activeMenu === 'admin-assets' && isAdmin && renderAdminAssetsView()}
          {activeMenu === 'admin-store' && isAdmin && renderAdminStoreView()}
          {activeMenu === 'admin-reading' && isAdmin && renderAdminReadingView()}
          {activeMenu === 'admin-roles' && isAdmin && renderAdminRolesView()}
          {activeMenu === 'admin-transfer' && isAdmin && renderAdminTransferView()}
          {activeMenu === 'admin-settings' && isAdmin && renderAdminSettingsView()}
        </main>
      </div>
    </div>
  );
};

export default App;
