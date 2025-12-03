import { useState, useEffect, useRef, useMemo } from 'react';
import {
  GameState,
  GamePhase,
  Team,
  STARTING_CHIPS,
  NetworkMessage,
  MIN_TEAMS,
  MAX_TEAMS_LIMIT,
} from './types';
import {
  createDeck,
  calculateScore,
  generateId
} from './utils/game';
import { PlayerPanel } from './components/PlayerPanel';
import { Card } from './components/Card';
import { Chip } from './components/Chip';
import {
  Trophy,
  History,
  Users,
  Monitor,
  Smartphone,
  Briefcase,
  AlertTriangle,
  Lock,
  Play,
  Settings,
  X,
  CheckCircle2,
  LogOut,
  Eye
} from 'lucide-react';

const CHANNEL_NAME = 'minus_auction_corporate_v1';
const ADMIN_PASSWORD = '6749467';

type ViewMode = 'LANDING' | 'ADMIN' | 'USER';

export default function App() {
  const [isServer, setIsServer] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('LANDING');

  const myClientId = useRef(generateId()).current;

  const [impersonateTeamId, setImpersonateTeamId] = useState<string | null>(null);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPwdInput, setAdminPwdInput] = useState('');
  const [setupConfig, setSetupConfig] = useState({ roomName: '전략기획실 A', maxTeams: 5 });

  const [joinName, setJoinName] = useState('');
  const [joinGroup, setJoinGroup] = useState(1);

  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.LOBBY,
    roomConfig: { roomName: '', maxTeams: 5 },
    deck: [],
    currentCard: null,
    pot: 0,
    hiddenCard: null,
    teams: [],
    currentTurnIndex: 0,
    logs: [],
    winnerId: null,
  });

  const bc = useRef<BroadcastChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.logs]);

  useEffect(() => {
    bc.current = new BroadcastChannel(CHANNEL_NAME);

    bc.current.onmessage = (event) => {
      const msg: NetworkMessage = event.data;

      if (isServer) {
        handleServerMessage(msg);
      } else {
        handleClientMessage(msg);
      }
    };

    const handleBeforeUnload = () => {
      if (!isServer && bc.current) {
        bc.current.postMessage({
          type: 'LEAVE_NOTIFY',
          payload: { clientId: myClientId }
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      bc.current?.close();
    };
  }, [isServer]);

  const broadcastState = (newState: GameState) => {
    if (bc.current) {
      bc.current.postMessage({ type: 'STATE_UPDATE', payload: newState });
    }
    setGameState(newState);
  };

  const handleServerMessage = (msg: NetworkMessage) => {
    setGameState(prev => {
      let nextState = { ...prev };

      if (msg.type === 'JOIN_REQUEST') {
        const existingTeamIndex = prev.teams.findIndex(t => t.groupNumber === msg.payload.group);

        if (existingTeamIndex !== -1) {
          const existingTeam = prev.teams[existingTeamIndex];
          if (existingTeam.members.some(m => m.clientId === msg.payload.clientId)) return prev;

          const updatedTeam = {
            ...existingTeam,
            members: [...existingTeam.members, { clientId: msg.payload.clientId, name: msg.payload.name }]
          };

          nextState.teams = [...prev.teams];
          nextState.teams[existingTeamIndex] = updatedTeam;
          nextState.teams.sort((a,b) => a.groupNumber - b.groupNumber);

          nextState.logs = [...prev.logs, `[SYSTEM] '${msg.payload.name}' 님이 ${msg.payload.group}조에 합류했습니다.`];
          broadcastState(nextState);
          return nextState;
        } else {
          if (prev.teams.length >= prev.roomConfig.maxTeams) return prev;

          const newTeam: Team = {
            id: generateId(),
            name: `${msg.payload.name} (대표)`,
            groupNumber: msg.payload.group,
            chips: STARTING_CHIPS,
            cards: [],
            score: STARTING_CHIPS,
            lastAction: null,
            members: [{ clientId: msg.payload.clientId, name: msg.payload.name }]
          };

          nextState.teams = [...prev.teams, newTeam].sort((a,b) => a.groupNumber - b.groupNumber);
          nextState.logs = [...prev.logs, `[SYSTEM] ${msg.payload.group}조 ('${newTeam.name}') 등록 완료.`];
          broadcastState(nextState);
          return nextState;
        }
      }

      if (msg.type === 'LEAVE_NOTIFY') {
        const teams = prev.teams.map(t => ({
          ...t,
          members: t.members.filter(m => m.clientId !== msg.payload.clientId)
        }));

        nextState = { ...prev, teams };
        broadcastState(nextState);
        return nextState;
      }

      if (msg.type === 'ACTION_PASS') {
        if (prev.phase !== GamePhase.PLAYING) return prev;
        const currentTeam = prev.teams[prev.currentTurnIndex];
        if (currentTeam.id !== msg.payload.teamId) return prev;

        const updatedTeams = prev.teams.map(t =>
          t.id === currentTeam.id
            ? { ...t, chips: t.chips - 1, score: calculateScore(t.cards, t.chips - 1), lastAction: 'PASS' as const }
            : t
        );

        nextState = {
          ...prev,
          pot: prev.pot + 1,
          teams: updatedTeams,
          currentTurnIndex: (prev.currentTurnIndex + 1) % prev.teams.length,
          logs: [...prev.logs, `[BID] ${currentTeam.groupNumber}조: 입찰 포기 (자원 1억 지불)`]
        };
        broadcastState(nextState);
        return nextState;
      }

      if (msg.type === 'ACTION_TAKE') {
        if (prev.phase !== GamePhase.PLAYING) return prev;
        const currentTeam = prev.teams[prev.currentTurnIndex];
        if (currentTeam.id !== msg.payload.teamId) return prev;

        const takenCard = prev.currentCard!;
        const takenPot = prev.pot;

        const newCards = [...currentTeam.cards, takenCard];
        const newChips = currentTeam.chips + takenPot;
        const newScore = calculateScore(newCards, newChips);

        const updatedTeams = prev.teams.map(t =>
          t.id === currentTeam.id
            ? { ...t, chips: newChips, cards: newCards, score: newScore, lastAction: 'TAKE' as const }
            : t
        );

        const logs = [...prev.logs, `[SUCCESS] ${currentTeam.groupNumber}조: ${takenCard}억 프로젝트 수주 (자원 +${takenPot}억)`];

        const remainingDeck = [...prev.deck];

        if (remainingDeck.length === 0) {
           let minLoss = -Infinity;
           let winnerId = null;
           updatedTeams.forEach(t => {
             if (t.score > minLoss) {
               minLoss = t.score;
               winnerId = t.id;
             }
           });
           nextState = {
             ...prev,
             phase: GamePhase.GAME_OVER,
             teams: updatedTeams,
             logs: [...logs, '[SYSTEM] 모든 프로젝트 경매가 종료되었습니다.'],
             winnerId: winnerId!
           };
        } else {
           const nextCard = remainingDeck.pop() || null;
           nextState = {
             ...prev,
             deck: remainingDeck,
             currentCard: nextCard,
             pot: 0,
             teams: updatedTeams,
             currentTurnIndex: prev.currentTurnIndex,
             logs: [...logs, `[NEW] 신규 프로젝트 공시: ${nextCard}억`]
           };
        }
        broadcastState(nextState);
        return nextState;
      }

      return prev;
    });
  };

  const handleClientMessage = (msg: NetworkMessage) => {
    if (msg.type === 'STATE_UPDATE') {
      setGameState(msg.payload);
    }
  };

  const myTeam = useMemo(() => {
    if (impersonateTeamId) {
      return gameState.teams.find(t => t.id === impersonateTeamId);
    }
    return gameState.teams.find(t => t.members.some(m => m.clientId === myClientId));
  }, [gameState.teams, myClientId, impersonateTeamId]);

  const joinGame = () => {
    if (!gameState.roomConfig.roomName) {
      alert("아직 개설된 게임방이 없습니다.");
      return;
    }
    if (!joinName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (bc.current) {
      bc.current.postMessage({
        type: 'JOIN_REQUEST',
        payload: { name: joinName, group: joinGroup, clientId: myClientId }
      });
    }

    setViewMode('USER');
  };

  const sendAction = (type: 'ACTION_PASS' | 'ACTION_TAKE') => {
    if (bc.current && myTeam) {
      bc.current.postMessage({ type, payload: { teamId: myTeam.id } });
    }
  };

  const attemptAdminLogin = () => {
    if (adminPwdInput === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      if (isServer) {
          setViewMode('ADMIN');
          setShowAdminLogin(false);
      }
    } else {
      alert('접속 코드가 올바르지 않습니다.');
    }
  };

  const createRoom = () => {
    if (!setupConfig.roomName.trim()) {
      alert("방 이름을 입력해주세요.");
      return;
    }

    setIsServer(true);
    setIsAdminAuthenticated(true);
    setViewMode('ADMIN');
    setShowAdminLogin(false);

    const newState: GameState = {
      phase: GamePhase.LOBBY,
      roomConfig: { roomName: setupConfig.roomName, maxTeams: setupConfig.maxTeams },
      deck: [],
      currentCard: null,
      pot: 0,
      hiddenCard: null,
      teams: [],
      currentTurnIndex: 0,
      logs: [`[SYSTEM] 방 개설 완료: ${setupConfig.roomName} (최대 ${setupConfig.maxTeams}팀)`],
      winnerId: null,
    };
    broadcastState(newState);
  };

  const startGame = () => {
    const fullDeck = createDeck();
    const hiddenCard = fullDeck.pop() || null;
    const firstCard = fullDeck.pop() || null;

    const cleanTeams = gameState.teams.map(t => ({ ...t, lastAction: null }));

    const newState: GameState = {
      ...gameState,
      phase: GamePhase.PLAYING,
      deck: fullDeck,
      hiddenCard,
      currentCard: firstCard,
      pot: 0,
      teams: cleanTeams,
      currentTurnIndex: Math.floor(Math.random() * gameState.teams.length),
      logs: [
        ...gameState.logs,
        '[SYSTEM] 입찰 시스템 가동 시작.',
        `[SYSTEM] 비공개 프로젝트(히든카드) 1건이 제외되었습니다.`,
        `[NEW] 첫번째 프로젝트 공시: ${firstCard}억`
      ],
      winnerId: null
    };
    broadcastState(newState);
  };

  const resetGame = () => {
    const newState: GameState = {
      phase: GamePhase.LOBBY,
      roomConfig: gameState.roomConfig,
      deck: [],
      currentCard: null,
      pot: 0,
      hiddenCard: null,
      teams: gameState.teams.map(t => ({...t, cards: [], chips: STARTING_CHIPS, score: STARTING_CHIPS, lastAction: null })),
      currentTurnIndex: 0,
      logs: ['[SYSTEM] 시스템이 리셋되었습니다. 대기 중...'],
      winnerId: null,
    };
    broadcastState(newState);
  };

  const switchToUserView = (teamId: string) => {
    setImpersonateTeamId(teamId);
    setViewMode('USER');
  };

  const returnToAdminView = () => {
    setImpersonateTeamId(null);
    setViewMode('ADMIN');
  };

  // ---------------- RENDER ----------------

  const LogsView = () => (
    <div className="bg-black/40 border-l border-slate-800 flex flex-col h-full font-mono text-xs">
      <div className="p-3 border-b border-slate-800 text-slate-400 font-bold flex items-center gap-2 bg-slate-900/50">
        <History className="w-3 h-3" /> 시스템 로그 (LOG)
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
        {gameState.logs.map((log, i) => (
          <div key={i} className="flex gap-2 text-slate-400">
            <span className="text-slate-600">[{String(i+1).padStart(3, '0')}]</span>
            <span className={log.includes('[SUCCESS]') ? 'text-green-400' : log.includes('[NEW]') ? 'text-yellow-400' : ''}>
              {log.replace(/\[.*?\] /, '')}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );

  // 1. Landing Screen
  if (viewMode === 'LANDING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {isServer && (
          <div className="absolute top-0 left-0 w-full bg-red-900/80 text-white text-center text-xs py-1 z-50">
            ⚠ 게임 서버가 백그라운드에서 실행 중입니다 ⚠
          </div>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0"></div>

        <div className="absolute top-4 right-4 z-20 flex gap-2">
           {isAdminAuthenticated && (
             <button
                onClick={() => setViewMode('ADMIN')}
                className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-blue-500/20"
             >
                <Monitor className="w-3 h-3" /> 관리자 뷰 입장
             </button>
           )}
          <button
            onClick={() => { setShowAdminLogin(true); setAdminPwdInput(''); }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-400 transition-colors px-3 py-1 rounded-full border border-slate-800 hover:border-slate-600 bg-slate-950/50 backdrop-blur"
          >
            <Lock className="w-3 h-3" /> <span className="text-xs font-mono">{isAdminAuthenticated ? '관리자 설정' : '관리자 로그인'}</span>
          </button>
        </div>

        <div className="z-10 text-center w-full max-w-sm mx-auto">
          <div className="mb-4 inline-block border border-yellow-500/30 bg-yellow-500/10 px-4 py-1 rounded-full text-yellow-500 text-xs font-mono tracking-widest animate-pulse">
             CORPORATE BIDDING SYSTEM
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-100 to-slate-500 mb-2 tracking-tighter">
            MINUS<br/>AUCTION
          </h1>
          <p className="text-slate-500 text-sm font-light mb-12 tracking-wide">
            마이너스 프로젝트 입찰 경쟁 시스템
          </p>

          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-6 rounded-2xl text-left shadow-2xl relative overflow-hidden w-full">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-green-500"></div>
             <div className="flex items-center gap-2 mb-6">
                <Smartphone className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold text-white">팀 접속 (참가자)</h2>
             </div>

             {!gameState.roomConfig.roomName ? (
                 <div className="text-center py-8 text-slate-500 text-sm">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                    <p>현재 개설된 게임방이 없습니다.</p>
                    <p>관리자가 방을 만든 후 접속해주세요.</p>
                 </div>
             ) : (
                 <div className="space-y-4">
                   <div className="p-2 bg-slate-800 rounded border border-slate-700 mb-2">
                      <span className="text-[10px] text-slate-400 block">현재 게임방</span>
                      <span className="text-white font-bold">{gameState.roomConfig.roomName}</span>
                   </div>

                   <div>
                      <label className="text-xs text-slate-400 block mb-1">참가 조 선택</label>
                      <select
                        className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-green-500 appearance-none cursor-pointer"
                        value={joinGroup}
                        onChange={(e) => setJoinGroup(Number(e.target.value))}
                      >
                        {Array.from({ length: gameState.roomConfig.maxTeams }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>{num}조</option>
                        ))}
                      </select>
                   </div>

                   <div>
                      <label className="text-xs text-slate-400 block mb-1">이름 (본인)</label>
                      <input
                         type="text"
                         placeholder="이름 입력"
                         className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-green-500"
                         value={joinName}
                         onChange={(e) => setJoinName(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && joinGame()}
                       />
                   </div>
                   <button
                     onClick={joinGame}
                     className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all shadow-[0_4px_14px_0_rgba(34,197,94,0.39)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.23)] active:scale-95 flex items-center justify-center gap-2"
                   >
                     접속하기 <Briefcase className="w-4 h-4" />
                   </button>
                 </div>
             )}
          </div>
        </div>

        {/* Admin Login/Setup Modal */}
        {showAdminLogin && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
               <button
                 onClick={() => setShowAdminLogin(false)}
                 className="absolute top-4 right-4 text-slate-500 hover:text-white"
               >
                 <X className="w-5 h-5"/>
               </button>

               {!isAdminAuthenticated ? (
                 <>
                   <div className="flex items-center gap-2 mb-4 text-white font-bold">
                     <Lock className="w-5 h-5 text-red-500"/> 관리자 인증
                   </div>
                   <div className="mb-4">
                       <input
                         type="password"
                         placeholder="접속 코드 입력"
                         className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white font-mono focus:border-red-500 outline-none mb-2"
                         value={adminPwdInput}
                         onChange={(e) => setAdminPwdInput(e.target.value)}
                       />
                       <button
                         onClick={attemptAdminLogin}
                         className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded mt-2"
                       >
                         인증 확인
                       </button>
                   </div>
                 </>
               ) : (
                 <>
                    <div className="flex items-center gap-2 mb-4 text-white font-bold">
                        <Settings className="w-5 h-5 text-blue-500"/> 게임방 개설
                    </div>

                    {isServer ? (
                        <div className="bg-blue-900/20 text-blue-200 p-3 rounded mb-4 text-sm">
                            현재 방이 개설되어 있습니다.<br/>
                            <strong>{gameState.roomConfig.roomName}</strong>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-xs text-slate-400">게임방 이름</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white mb-2"
                                value={setupConfig.roomName}
                                onChange={(e) => setSetupConfig({...setupConfig, roomName: e.target.value})}
                            />
                            <label className="text-xs text-slate-400">참가 팀 수 ({MIN_TEAMS}-{MAX_TEAMS_LIMIT})</label>
                            <div className="flex items-center gap-3 mb-4">
                                <input
                                type="range"
                                min={MIN_TEAMS}
                                max={MAX_TEAMS_LIMIT}
                                className="flex-1 accent-blue-500"
                                value={setupConfig.maxTeams}
                                onChange={(e) => setSetupConfig({...setupConfig, maxTeams: Number(e.target.value)})}
                                />
                                <span className="font-mono text-xl font-bold text-blue-400 w-8">{setupConfig.maxTeams}</span>
                            </div>
                            <button
                                onClick={createRoom}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold shadow-lg"
                            >
                                게임방 생성 및 입장
                            </button>
                        </div>
                    )}

                    {isServer && (
                         <button
                           onClick={() => { setViewMode('ADMIN'); setShowAdminLogin(false); }}
                           className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded font-bold mt-2"
                         >
                           관리자 뷰로 이동
                         </button>
                    )}
                 </>
               )}
             </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Admin View
  if (viewMode === 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${gameState.phase === GamePhase.PLAYING ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <div>
              <h1 className="text-xl font-bold tracking-widest leading-none">MINUS AUCTION</h1>
              <span className="text-slate-500 text-xs font-mono">{gameState.roomConfig.roomName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono text-slate-400">
            <button
                onClick={() => setViewMode('LANDING')}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-300 rounded border border-slate-700 transition-colors"
            >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">나가기</span>
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800 rounded">
               <Users className="w-4 h-4"/>
               <span>{gameState.teams.length}/{gameState.roomConfig.maxTeams} 팀</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">

            {/* LOBBY STATE */}
            {gameState.phase === GamePhase.LOBBY && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="bg-slate-900/80 border border-slate-700 p-8 rounded-xl max-w-6xl w-full backdrop-blur-md">
                   <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Monitor className="text-blue-500"/> 참가 팀 현황
                      </h2>
                      <div className="text-slate-400 text-sm font-mono flex items-center gap-2">
                         <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 준비됨
                         </span>
                         <span className="text-slate-600">|</span>
                         <span>참가 팀 대기 중...</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                     {gameState.teams.map(team => {
                       const activeCount = team.members.length;
                       const isActive = activeCount > 0;

                       return (
                         <div
                           key={team.id}
                           className={`
                             p-4 rounded-lg flex flex-col items-start gap-2 relative overflow-hidden transition-all duration-300 group
                             ${isActive
                               ? 'bg-slate-800 border-2 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.15)] scale-[1.02] z-10'
                               : 'bg-slate-900 border border-slate-800 opacity-60 grayscale'
                             }
                           `}
                         >
                           {isActive && (
                             <div className="absolute top-0 right-0 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl">
                               준비됨
                             </div>
                           )}

                            <button
                                onClick={() => switchToUserView(team.id)}
                                className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                            >
                                <span className="flex items-center gap-2 text-white font-bold border border-white/50 px-3 py-1 rounded-full hover:bg-white/10">
                                    <Eye className="w-4 h-4" /> 사용자 뷰
                                </span>
                            </button>

                           <div className="flex flex-col w-full">
                              <span className="text-[10px] font-mono text-slate-500 block mb-1">{team.groupNumber}조</span>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                <span className={`font-bold truncate text-lg ${isActive ? 'text-white' : 'text-slate-500'}`}>{team.name}</span>
                              </div>
                           </div>

                           <div className={`
                             w-full rounded p-2 text-xs flex flex-col gap-1
                             ${isActive ? 'bg-black/20' : 'bg-transparent'}
                           `}>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 flex items-center gap-1">
                                  <Users className="w-3 h-3" /> 접속 인원
                                </span>
                                <span className={`font-mono font-bold ${isActive ? 'text-green-400 text-sm' : 'text-slate-600'}`}>
                                  {activeCount}명
                                </span>
                              </div>
                              {isActive && (
                                <div className="mt-1 pt-1 border-t border-slate-700/50 text-[10px] text-slate-400 space-y-0.5">
                                   {team.members.slice(0, 3).map((m, idx) => (
                                     <div key={idx} className="truncate flex items-center gap-1">
                                        <CheckCircle2 className="w-2 h-2 text-green-600" /> {m.name}
                                     </div>
                                   ))}
                                   {team.members.length > 3 && <div>... 외 {team.members.length - 3}명</div>}
                                </div>
                              )}
                           </div>
                         </div>
                       );
                     })}

                     {Array.from({length: Math.max(0, gameState.roomConfig.maxTeams - gameState.teams.length)}).map((_, i) => (
                       <div key={i} className="bg-slate-900/30 p-4 rounded-lg border border-slate-800 border-dashed text-slate-700 flex flex-col items-center justify-center font-mono min-h-[120px]">
                         <span className="text-2xl opacity-20 mb-2">EMPTY</span>
                         <span className="text-xs">슬롯 {gameState.teams.length + i + 1}</span>
                       </div>
                     ))}
                   </div>

                   <div className="text-center">
                     <button
                       onClick={startGame}
                       disabled={gameState.teams.filter(t => t.members.length > 0).length < MIN_TEAMS}
                       className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded font-bold text-lg shadow-lg transition-all flex items-center gap-2 mx-auto"
                     >
                       <Play className="fill-current"/>
                       {gameState.teams.filter(t => t.members.length > 0).length < MIN_TEAMS ? `최소 ${MIN_TEAMS}팀 필요` : '경매 세션 시작'}
                     </button>
                     <p className="mt-4 text-slate-500 text-xs">
                       모든 팀원이 접속하면 '경매 세션 시작' 버튼을 눌러주세요.
                     </p>
                   </div>
                </div>
              </div>
            )}

            {/* PLAYING STATE */}
            {gameState.phase !== GamePhase.LOBBY && (
               <div className="flex-1 flex flex-col gap-6">
                  <div className={`grid gap-3 ${gameState.teams.length > 8 ? 'grid-cols-4 md:grid-cols-5 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {gameState.teams.map((team, idx) => (
                      <div key={team.id} className="relative group">
                          <PlayerPanel
                            team={team}
                            isActive={gameState.currentTurnIndex === idx && gameState.phase === GamePhase.PLAYING}
                            isWinner={gameState.winnerId === team.id}
                          />
                          <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => switchToUserView(team.id)} className="bg-black/50 hover:bg-black p-1 rounded text-white" title="사용자 뷰 보기">
                                  <Eye className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 flex items-center justify-center relative my-4">
                     {gameState.phase === GamePhase.GAME_OVER ? (
                        <div className="text-center bg-slate-900/90 p-10 rounded-2xl border border-yellow-500/30 shadow-2xl backdrop-blur">
                           <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 animate-bounce"/>
                           <h2 className="text-4xl font-bold text-white mb-2">최종 우승팀</h2>
                           <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-6">
                             {gameState.teams.find(t => t.id === gameState.winnerId)?.name || 'Unknown'}
                           </div>
                           <button onClick={resetGame} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300">
                             새 게임 시작
                           </button>
                        </div>
                     ) : (
                       <div className="flex items-center gap-8 md:gap-16 scale-90 md:scale-110">
                          <div className="relative group perspective-1000">
                            <div className="absolute -inset-4 bg-red-500/20 blur-xl rounded-full animate-pulse"></div>
                            <Card value={gameState.currentCard!} size="lg" className="z-10 shadow-2xl rotate-y-12" />
                          </div>

                          <div className="flex flex-col gap-4 md:gap-8">
                             <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-xl min-w-[200px] md:min-w-[240px] shadow-xl">
                                <span className="text-slate-500 text-sm font-mono block mb-2 border-b border-slate-800 pb-1">프로젝트 지원금 (Pot)</span>
                                <div className="flex items-center gap-4">
                                   <Chip count={gameState.pot} className="scale-125 md:scale-150" />
                                   <span className="text-4xl md:text-5xl font-bold text-yellow-500 font-mono">{gameState.pot}억</span>
                                </div>
                             </div>

                             <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-xl min-w-[200px] md:min-w-[240px] shadow-xl">
                                <span className="text-slate-500 text-sm font-mono block mb-2 border-b border-slate-800 pb-1">시장 현황</span>
                                <div className="flex items-center gap-4">
                                   <Briefcase className="w-6 h-6 md:w-8 md:h-8 text-slate-400"/>
                                   <span className="text-3xl md:text-4xl font-bold text-slate-200 font-mono">{gameState.deck.length} <span className="text-base md:text-lg text-slate-500">건 남음</span></span>
                                </div>
                             </div>

                             <div className="mt-2">
                                <div className="text-slate-400 text-sm mb-2 font-mono">현재 입찰 진행 (BIDDER)</div>
                                <div className="text-2xl md:text-3xl font-bold text-white bg-blue-600/20 border-l-4 border-blue-500 px-6 py-3 rounded-r animate-pulse">
                                  {gameState.teams[gameState.currentTurnIndex]?.name}
                                </div>
                             </div>
                          </div>
                       </div>
                     )}
                  </div>
               </div>
            )}
          </div>

          <div className="w-80 h-full shrink-0 border-l border-slate-800 bg-slate-950 hidden xl:block">
            <LogsView />
          </div>
        </div>
      </div>
    );
  }

  // 3. User View (Mobile Controller)
  if (viewMode === 'USER') {
    const team = myTeam;

    if (!team) {
       return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
           <div>
             <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-4"/>
             <h2 className="text-xl font-bold text-white mb-2">팀 정보 대기 중...</h2>
             <p className="text-slate-400 mb-6">서버로부터 팀 정보를 수신하고 있습니다.</p>
             <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-800 rounded text-white">새로고침</button>
             {isAdminAuthenticated && (
                <button onClick={returnToAdminView} className="block w-full mt-4 text-blue-500">관리자 화면으로 복귀</button>
             )}
           </div>
        </div>
      );
    }

    const isMyTurn = gameState.teams[gameState.currentTurnIndex]?.id === team.id && gameState.phase === GamePhase.PLAYING;
    const isLobby = gameState.phase === GamePhase.LOBBY;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans relative">
        {isAdminAuthenticated && (
            <button
                onClick={returnToAdminView}
                className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg border border-blue-400"
            >
                <Monitor className="w-6 h-6" />
            </button>
        )}

        <header className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 z-40 shadow-md">
           <div>
             <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg leading-tight">{team.groupNumber}조 ({team.name})</h1>
                {impersonateTeamId && <span className="bg-red-500 text-xs px-1 rounded">ADMIN VIEW</span>}
             </div>
             <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
               <Users className="w-3 h-3" /> {team.members.length}명 접속 중
             </span>
           </div>
           <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">자원 보유량</div>
              <div className="font-bold text-yellow-500 flex items-center justify-end gap-1 text-lg">
                <Chip count={team.chips} className="w-4 h-4" /> {team.chips}억
              </div>
           </div>
        </header>

        <div className="flex-1 p-4 flex flex-col overflow-y-auto">
           {isLobby && (
             <div className="mb-4 bg-slate-800/80 border border-slate-700 p-4 rounded-lg flex items-center gap-4 animate-in slide-in-from-top-2">
                 <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                 </div>
                 <div>
                     <h3 className="font-bold text-white">접속 대기 중</h3>
                     <p className="text-xs text-slate-400">
                        현재 <span className="text-green-400 font-bold">{gameState.teams.length}/{gameState.roomConfig.maxTeams}</span> 팀 접속.<br/>
                        관리자가 게임을 시작할 때까지 대기해주세요.
                     </p>
                 </div>
             </div>
           )}

           {gameState.phase === GamePhase.GAME_OVER ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                {gameState.winnerId === team.id ? (
                  <>
                    <div className="relative mb-6">
                       <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full"></div>
                       <Trophy className="w-24 h-24 text-yellow-400 relative z-10 animate-bounce"/>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">최종 우승!</h2>
                    <p className="text-slate-400 mb-8">탁월한 위기 관리 능력을 보여주셨습니다.</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-6 grayscale opacity-50">🏢</div>
                    <h2 className="text-2xl font-bold text-slate-300 mb-2">경매 종료</h2>
                    <p className="text-slate-500 mb-8">수고하셨습니다.</p>
                  </>
                )}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-full">
                   <div className="text-slate-500 text-xs uppercase mb-1">최종 순이익 (Final Net Profit)</div>
                   <div className="text-4xl font-mono font-bold text-white">{team.score}억</div>
                </div>
              </div>
           ) : (
             <div className={`flex flex-col gap-6 pb-6 ${isLobby ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>

               <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                     <AlertTriangle className="w-24 h-24" />
                  </div>
                  <h3 className="text-[10px] text-blue-400 mb-3 font-mono tracking-widest uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                    현재 경매 프로젝트
                  </h3>
                  <div className="flex items-center justify-between relative z-10">
                     <div className="flex flex-col">
                        <span className="text-slate-400 text-xs mb-1">프로젝트 손실규모</span>
                        <span className="text-4xl font-bold text-red-500 tracking-tighter">
                            {gameState.currentCard !== null ? `${gameState.currentCard}억` : '-'}
                        </span>
                     </div>
                     <div className="h-12 w-px bg-slate-700 mx-4"></div>
                     <div className="flex flex-col items-end">
                        <span className="text-slate-400 text-xs mb-1">인수 지원금 (Pot)</span>
                        <span className="text-4xl font-bold text-yellow-500 tracking-tighter">+{gameState.pot}억</span>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => sendAction('ACTION_PASS')}
                    disabled={!isMyTurn || (team.chips) <= 0}
                    className="group relative py-8 rounded-2xl bg-slate-800 border border-slate-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="text-xl font-bold relative z-10">패스 (PASS)</span>
                    <span className="text-xs text-slate-400 relative z-10 bg-black/20 px-2 py-0.5 rounded">-1억 자원 지불</span>
                  </button>

                  <button
                    onClick={() => sendAction('ACTION_TAKE')}
                    disabled={!isMyTurn}
                    className="group relative py-8 rounded-2xl bg-red-900/80 border border-red-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-red-800 to-red-900 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="text-xl font-bold text-red-100 relative z-10">입찰 (TAKE)</span>
                    <span className="text-xs text-red-300 relative z-10 bg-black/20 px-2 py-0.5 rounded">현재 자원 모두 획득</span>
                  </button>
               </div>

               {!isLobby && (
                   !isMyTurn ? (
                    <div className="text-center p-3 bg-slate-900/80 backdrop-blur rounded-lg border border-slate-800 text-slate-400 text-sm animate-pulse">
                        현재 <span className="text-white font-bold">{gameState.teams[gameState.currentTurnIndex]?.name}</span> 팀이 의사결정 중입니다...
                    </div>
                    ) : (
                    <div className="text-center p-3 bg-green-900/30 rounded-lg border border-green-500/50 text-green-400 text-sm font-bold animate-pulse">
                        귀사의 차례입니다. 결정을 내려주세요!
                    </div>
                    )
               )}

               <div className="mt-2">
                  <h3 className="text-xs text-slate-500 mb-3 font-mono border-b border-slate-800 pb-1">프로젝트 포트폴리오</h3>
                  <div className="bg-slate-900/50 rounded-xl p-4 min-h-[120px] flex flex-wrap gap-2 content-start border border-slate-800">
                     {team.cards.sort((a,b)=>a-b).map(card => (
                       <div key={card} className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-red-400 font-mono font-bold text-lg shadow-sm">
                         {card}
                       </div>
                     ))}
                     {team.cards.length === 0 && (
                       <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm min-h-[80px]">
                          보유한 마이너스 프로젝트가 없습니다.
                       </div>
                     )}
                  </div>
                  <div className="flex justify-between items-center mt-2 px-2">
                     <span className="text-xs text-slate-500">현재 예상 순이익</span>
                     <span className={`font-mono font-bold text-lg ${team.score > -30 ? 'text-blue-400' : 'text-red-400'}`}>
                        {team.score}억
                     </span>
                  </div>
               </div>

             </div>
           )}
        </div>
      </div>
    );
  }

  return null;
}
