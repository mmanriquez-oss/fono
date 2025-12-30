
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppStatus, AppState, AnalysisResult, WordResult, WordInfo } from './types';
import { GeminiService } from './services/gemini';
import confetti from 'canvas-confetti';
import { 
  Mic, 
  Square, 
  RotateCcw, 
  Volume2, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Star,
  Trophy,
  Plus,
  Trash2,
  Play,
  Cloud,
  BookOpen,
  Info,
  Loader2,
  Image as ImageIcon,
  ScrollText,
  Wand2
} from 'lucide-react';

const gemini = new GeminiService();

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION = 1500;

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    wordList: [],
    currentIndex: 0,
    totalScore: 0,
    status: AppStatus.SETUP,
    analysis: null,
    error: null,
    history: [],
  });

  const [newWord, setNewWord] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (state.status === AppStatus.GAME_RESULTS && state.analysis && state.analysis.score >= 90) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    if (state.status === AppStatus.GAME_OVER) {
       const end = Date.now() + (4 * 1000);
       const interval: any = setInterval(() => {
         if (Date.now() > end) return clearInterval(interval);
         confetti({ startVelocity: 30, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });
       }, 200);
       return () => clearInterval(interval);
    }
  }, [state.status, state.analysis]);

  const addWord = async () => {
    const wordText = newWord.trim();
    if (!wordText) return;
    const newWordInfo: WordInfo = { text: wordText, isGeneratingImage: true };
    setState(prev => ({ ...prev, wordList: [...prev.wordList, newWordInfo] }));
    setNewWord('');
    try {
      const imageUrl = await gemini.generateImage(wordText);
      setState(prev => ({
        ...prev,
        wordList: prev.wordList.map(w => w.text === wordText ? { ...w, imageUrl, isGeneratingImage: false } : w)
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        wordList: prev.wordList.map(w => w.text === wordText ? { ...w, isGeneratingImage: false } : w)
      }));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleAnalyze(blob);
      };
      mediaRecorder.start();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudio = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        setAudioLevel(Math.sqrt(sum / dataArray.length));
        animationFrameRef.current = requestAnimationFrame(checkAudio);
      };
      checkAudio();
      
      setState(prev => ({ ...prev, status: AppStatus.GAME_RECORDING }));
    } catch (err) {
      setState(prev => ({ ...prev, error: 'No encontré tu micrófono mágico.' }));
    }
  };

  const handleAnalyze = async (blob: Blob) => {
    setState(prev => ({ ...prev, status: AppStatus.GAME_ANALYZING }));
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await gemini.analyzePronunciation(state.wordList[state.currentIndex].text, base64, blob.type);
        setState(prev => ({ 
          ...prev, 
          status: AppStatus.GAME_RESULTS, 
          analysis: result,
          totalScore: prev.totalScore + result.score,
          history: [...prev.history, { word: state.wordList[state.currentIndex], analysis: result }]
        }));
      } catch (e) {
        setState(prev => ({ ...prev, status: AppStatus.GAME_IDLE, error: 'Reintenta, la magia falló.' }));
      }
    };
  };

  return (
    <div className="min-h-screen bg-[#FFF5F7] flex flex-col items-center p-4 md:p-8 selection:bg-pink-200 overflow-x-hidden">
      <header className="w-full max-w-2xl flex flex-row items-center justify-between mb-6 md:mb-8">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-pink-500 p-2 md:p-3 rounded-xl md:rounded-2xl shadow-lg rotate-[-3deg]">
            <Sparkles className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h1 className="text-xl md:text-3xl font-black text-pink-600">Mundo<span className="text-blue-500">Mágico</span></h1>
        </div>
        <div className="bg-white px-3 py-1 md:px-4 md:py-2 rounded-full shadow-sm border-2 border-pink-100 text-pink-500 font-black text-xs md:text-sm flex items-center gap-1 md:gap-2">
          <Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-400 text-yellow-400" />
          <span>{state.totalScore} <span className="hidden sm:inline">Puntos</span></span>
        </div>
      </header>

      <main className="w-full max-w-2xl pb-10 flex flex-col items-center">
        
        {state.status === AppStatus.SETUP && (
          <div className="w-full bg-white p-6 md:p-8 rounded-3xl md:rounded-[3rem] shadow-2xl border-4 border-pink-50 animate-in zoom-in duration-300">
            <div className="text-center mb-6 md:mb-8">
              <Cloud className="text-blue-500 w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4" />
              <h2 className="text-xl md:text-2xl font-black text-gray-800 uppercase tracking-tight">Crea tu aventura</h2>
              <p className="text-gray-400 font-medium text-sm md:text-base">Escribe palabras y la IA las pintará</p>
            </div>
            <div className="space-y-4 md:space-y-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-gray-50 border-2 md:border-4 border-gray-100 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-lg md:text-xl font-bold focus:border-pink-300 outline-none w-full"
                  placeholder="Ej: Mariposa..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addWord()}
                />
                <button onClick={addWord} className="bg-pink-500 text-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-lg hover:scale-105 transition-all">
                  <Plus className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              </div>
              <div className="max-h-48 md:max-h-64 overflow-y-auto space-y-2 md:space-y-3 pr-1 custom-scrollbar">
                {state.wordList.map((word, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-pink-50 p-2 md:p-3 rounded-xl md:rounded-2xl border-2 border-pink-100">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-lg md:rounded-xl overflow-hidden flex items-center justify-center border border-pink-100 relative">
                        {word.isGeneratingImage ? <Loader2 className="w-4 h-4 md:w-6 md:h-6 text-pink-300 animate-spin" /> : 
                         word.imageUrl ? <img src={word.imageUrl} alt={word.text} className="w-full h-full object-cover" /> : 
                         <ImageIcon className="text-pink-100 w-5 h-5 md:w-6 md:h-6" />}
                      </div>
                      <span className="text-base md:text-lg font-black text-pink-700 truncate max-w-[120px] md:max-w-none">{word.text}</span>
                    </div>
                    <button onClick={() => setState(p => ({...p, wordList: p.wordList.filter((_, i) => i !== idx)}))} className="text-pink-300 hover:text-red-400 p-1 md:p-2"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                  </div>
                ))}
              </div>
              {state.wordList.length > 0 && (
                <button onClick={() => setState(prev => ({ ...prev, status: AppStatus.GAME_IDLE, currentIndex: 0, totalScore: 0, history: [], phonologicalReport: undefined }))} className="w-full bg-blue-500 text-white py-4 md:py-5 rounded-2xl md:rounded-3xl text-xl md:text-2xl font-black shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                  <Play className="fill-current w-6 h-6 md:w-8 md:h-8" /> ¡VAMOS A JUGAR!
                </button>
              )}
            </div>
          </div>
        )}

        {(state.status === AppStatus.GAME_IDLE || state.status === AppStatus.GAME_RECORDING || state.status === AppStatus.GAME_ANALYZING || state.status === AppStatus.GAME_RESULTS) && (
          <div className="w-full space-y-4 md:space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            <div className="w-full bg-white p-6 md:p-8 rounded-3xl md:rounded-[3.5rem] shadow-2xl border-4 border-white text-center overflow-hidden">
              {state.status === AppStatus.GAME_IDLE && (
                <div className="space-y-4 md:space-y-6">
                  <div className="w-40 h-40 md:w-56 md:h-56 mx-auto rounded-2xl md:rounded-[2rem] overflow-hidden shadow-inner border-4 border-pink-50 bg-pink-50 flex items-center justify-center">
                    {state.wordList[state.currentIndex].imageUrl ? <img src={state.wordList[state.currentIndex].imageUrl} className="w-full h-full object-cover animate-in zoom-in" /> : <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-pink-200 animate-spin" />}
                  </div>
                  <h2 className="text-4xl md:text-7xl font-black text-gray-800 tracking-tighter break-words">{state.wordList[state.currentIndex].text}</h2>
                  <div className="flex flex-col items-center gap-4 md:gap-6">
                    <button onClick={() => gemini.playReferenceAudio(state.wordList[state.currentIndex].text)} className="bg-blue-50 text-blue-600 px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black hover:bg-blue-100 flex items-center gap-2 transition-all text-sm md:text-base">
                      <Volume2 className="w-5 h-5 md:w-6 md:h-6" /> Escuchar
                    </button>
                    <button onClick={startRecording} className="w-20 h-20 md:w-28 md:h-28 bg-pink-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
                      <Mic className="w-10 h-10 md:w-14 md:h-14" />
                    </button>
                  </div>
                </div>
              )}

              {state.status === AppStatus.GAME_RECORDING && (
                <div className="py-12 md:py-20 space-y-6 md:space-y-8">
                  <h3 className="text-2xl md:text-3xl font-black text-pink-600">¡Habla ahora!</h3>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-pink-500 transition-all" style={{ width: `${Math.min(100, audioLevel * 800)}%` }}></div></div>
                  <button onClick={() => mediaRecorderRef.current?.stop()} className="bg-gray-100 text-red-400 p-3 md:p-4 rounded-full"><Square className="w-6 h-6 md:w-8 md:h-8 fill-current" /></button>
                </div>
              )}

              {state.status === AppStatus.GAME_ANALYZING && (
                <div className="py-12 md:py-20 space-y-6 md:space-y-8 text-center">
                  <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-pink-500 animate-spin mx-auto" />
                  <h3 className="text-xl md:text-2xl font-black text-gray-600">Escuchando con polvos de estrellas...</h3>
                </div>
              )}

              {state.status === AppStatus.GAME_RESULTS && state.analysis && (
                <div className="space-y-4 md:space-y-6 animate-in zoom-in">
                  <div className="text-5xl md:text-6xl font-black text-pink-500">{state.analysis.score}</div>
                  <div className="bg-pink-50 p-4 md:p-6 rounded-2xl md:rounded-3xl text-base md:text-lg font-bold text-pink-600 italic">"{state.analysis.feedback}"</div>
                  <button 
                    onClick={async () => {
                      if (state.currentIndex < state.wordList.length - 1) {
                        setState(p => ({ ...p, currentIndex: p.currentIndex + 1, status: AppStatus.GAME_IDLE, analysis: null }));
                      } else {
                        setState(p => ({ ...p, status: AppStatus.GAME_GENERATING_REPORT }));
                        try {
                          const rep = await gemini.generatePhonologicalReport(state.history);
                          setState(p => ({ ...p, status: AppStatus.GAME_OVER, phonologicalReport: rep }));
                        } catch (err) {
                          setState(p => ({ ...p, status: AppStatus.GAME_OVER }));
                        }
                      }
                    }}
                    className="w-full py-4 md:py-5 rounded-2xl md:rounded-3xl text-xl md:text-2xl font-black shadow-xl flex items-center justify-center gap-3 bg-blue-500 text-white hover:bg-blue-600 transition-all"
                  >
                    Siguiente <Play className="fill-current w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {state.status === AppStatus.GAME_GENERATING_REPORT && (
          <div className="w-full bg-white p-10 md:p-16 rounded-3xl md:rounded-[4rem] shadow-2xl border-4 border-blue-50 text-center animate-pulse">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 animate-bounce">
               <ScrollText className="text-blue-500 w-8 h-8 md:w-12 md:h-12" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-blue-600 mb-2 md:mb-4 leading-tight">Escribiendo tu informe fonológico...</h2>
            <p className="text-gray-400 font-bold italic text-sm md:text-base">Uniendo todos tus sonidos mágicos.</p>
          </div>
        )}

        {state.status === AppStatus.GAME_OVER && (
          <div className="w-full space-y-6 md:space-y-8 animate-in slide-in-from-bottom-10">
            <div className="bg-white p-8 md:p-10 rounded-3xl md:rounded-[4rem] shadow-2xl border-4 border-yellow-50 text-center">
              <Trophy className="text-yellow-600 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6" />
              <h2 className="text-3xl md:text-5xl font-black text-gray-800 mb-3 md:mb-4 tracking-tighter">¡SUPER CAMPEONA!</h2>
              {state.phonologicalReport && (
                <div className="mt-6 md:mt-8 bg-yellow-50 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border-4 border-yellow-200 text-left">
                   <h3 className="text-xl md:text-2xl font-black text-yellow-700 mb-3 md:mb-4 flex items-center gap-2 leading-none"><Wand2 className="w-5 h-5 md:w-6 md:h-6" /> Informe Fonológico Mágico</h3>
                   <div className="font-bold text-yellow-900 whitespace-pre-wrap text-sm md:text-base leading-relaxed">{state.phonologicalReport}</div>
                </div>
              )}
               <button onClick={() => window.location.reload()} className="w-full mt-8 md:mt-10 bg-pink-500 text-white py-4 md:py-6 rounded-2xl md:rounded-3xl text-xl md:text-2xl font-black shadow-xl hover:bg-pink-600 transition-all flex items-center justify-center gap-3">
                 <RotateCcw className="w-6 h-6 md:w-8 md:h-8" /> ¡Jugar de nuevo!
               </button>
            </div>
          </div>
        )}

        {state.error && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-full shadow-2xl flex items-center gap-2 md:gap-3 z-[100] animate-bounce max-w-[90vw] text-center">
             <AlertCircle className="w-5 h-5 md:w-6 md:h-6 shrink-0" /> <span className="font-bold text-sm md:text-base">{state.error}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
