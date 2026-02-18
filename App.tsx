
import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, Github, Settings, LayoutGrid, Info, Zap, Download, Camera, X, Wand2, Sparkles, Mic } from 'lucide-react';
import { Message, Role } from './types';
import { gemini } from './services/geminiService';
import { APP_NAME, FEATURES } from './constants';
import ChatBubble from './components/ChatBubble';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isImageMode, setIsImageMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleUpdateMessage = (messageId: string, updatedContent: any[]) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, content: updatedContent } : msg
    ));
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !pendingImage) || isTyping) return;

    const userText = inputValue.trim();
    const currentPendingImage = pendingImage;
    const forceImageGen = isImageMode;
    
    setInputValue('');
    setPendingImage(null);
    setIsImageMode(false);
    
    if (isListening) {
      recognitionRef.current?.stop();
    }
    
    const userContent = [];
    if (userText) userContent.push({ text: userText });
    if (currentPendingImage) userContent.push({ image: currentPendingImage });

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: userContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      role: Role.AGENT,
      content: [],
      timestamp: new Date(),
      isPending: true,
    };

    setMessages(prev => [...prev, botMessage]);

    try {
      const isImageRequest = !currentPendingImage && (forceImageGen || gemini.shouldGenerateImage(userText));
      
      if (isImageRequest) {
        const confirmationText = forceImageGen 
          ? `Initiating Banana Vision... Crafting high-fidelity visualization for: "${userText}"`
          : await gemini.generateTextResponse(`The user wants to visualize: "${userText}". Confirm you are generating it.`);
          
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: [{ text: confirmationText }], isPending: true } 
            : msg
        ));

        const imageUrl = await gemini.generateImage(userText);
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: [{ text: confirmationText }, { image: imageUrl }], isPending: false } 
            : msg
        ));
      } else {
        const history = messages.slice(-6).map(m => ({
          role: m.role === Role.USER ? 'user' : 'model',
          parts: m.content.map(c => {
            if (c.text) return { text: c.text };
            if (c.image) {
              const data = c.image.split(',')[1];
              const mimeType = c.image.split(',')[0].split(':')[1].split(';')[0];
              return { inlineData: { data, mimeType } };
            }
            return { text: '' };
          })
        }));

        const textResponse = await gemini.generateTextResponse(userText || "What's in this image?", history, currentPendingImage || undefined);
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: [{ text: textResponse }], isPending: false } 
            : msg
        ));
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: [{ text: "The generation failed. Please refine your prompt and try again." }], isPending: false } 
          : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearChat = () => {
    if (window.confirm("Are you sure you want to clear your conversation?")) {
      setMessages([]);
    }
  };

  const exportChatHistory = () => {
    if (messages.length === 0) {
      alert("No messages to export.");
      return;
    }

    let textContent = `${APP_NAME} - Conversation Export\n`;
    textContent += `Date: ${new Date().toLocaleString()}\n`;
    textContent += `-------------------------------------------\n\n`;

    messages.forEach((msg) => {
      const time = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const roleName = msg.role === Role.USER ? 'USER' : 'NANO BANANA';
      
      textContent += `[${time}] ${roleName}:\n`;
      msg.content.forEach((part) => {
        if (part.text) textContent += `${part.text}\n`;
        if (part.image) textContent += `[Generated Image Attached]\n`;
      });
      textContent += `\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nano-banana-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] overflow-hidden selection:bg-yellow-400 selection:text-black">
      <aside className="hidden lg:flex flex-col w-72 h-full glass border-r border-white/5 p-6 z-20">
        <div className="flex items-center space-x-3 mb-10 transition-glass hover:translate-x-1">
          <div className="w-10 h-10 banana-gradient rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)] animate-elastic-reveal">
            <Zap className="text-black" fill="black" size={24} />
          </div>
          <div className="animate-reveal-blur" style={{ animationDelay: '0.1s' }}>
            <h1 className="font-bold text-lg banana-text-gradient">{APP_NAME}</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Native Multimodal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-white/30 uppercase ml-2 mb-2">Capabilities</p>
            {FEATURES.map((f, i) => (
              <div key={i} className={`flex items-start space-x-3 p-3 rounded-xl transition-all cursor-default ${i === 1 && isImageMode ? 'bg-yellow-400/10 border border-yellow-400/20' : 'hover:bg-white/5'}`}>
                <div className={`mt-0.5 transition-all duration-500 ${i === 1 && isImageMode ? 'scale-110 text-yellow-400' : ''}`}>{f.icon}</div>
                <div>
                  <h3 className={`text-sm font-medium transition-colors ${i === 1 && isImageMode ? 'text-yellow-400' : 'text-white/90'}`}>{f.title}</h3>
                  <p className="text-xs text-white/40">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 animate-reveal-blur" style={{ animationDelay: '0.3s' }}>
            <p className="text-[10px] font-bold text-white/30 uppercase ml-2 mb-2">Workspace</p>
            <button onClick={exportChatHistory} className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-white/5 transition-glass text-white/60 group">
              <Download size={18} className="group-hover:text-yellow-400 transition-all duration-500" />
              <span className="text-sm">Export Chat</span>
            </button>
            <button onClick={clearChat} className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-glass text-white/60 group">
              <Trash2 size={18} className="group-hover:scale-110 transition-transform duration-500" />
              <span className="text-sm">Clear Conversation</span>
            </button>
          </div>
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-4 animate-reveal-blur" style={{ animationDelay: '0.5s' }}>
          <div className="p-4 glass rounded-2xl border border-white/5 hover:border-white/10 transition-glass">
             <div className="flex items-center space-x-2 mb-2">
                <Sparkles size={14} className="text-yellow-400 animate-pulse" />
                <span className="text-[10px] font-bold text-white/60 uppercase">PRO MODE ACTIVE</span>
             </div>
             <p className="text-[10px] text-white/30 leading-relaxed">Gemini 3 Flash Pro provides 2x faster reasoning for visual tasks.</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative h-full transition-all duration-700">
        <header className="flex items-center justify-between px-6 h-16 glass border-b border-white/5 sticky top-0 z-30 transition-glass">
          <div className="flex items-center lg:hidden">
            <Zap className="text-yellow-400 mr-2 animate-elastic-reveal" size={20} />
            <span className="font-bold text-white tracking-tight">Nano Banana</span>
          </div>
          <div className="hidden lg:flex items-center text-xs text-white/40">
            <Info size={14} className="mr-2" />
            Nano Banana supports image analysis & high-fidelity generation.
          </div>
          <div className="flex items-center space-x-4">
            <div className={`px-4 py-1.5 ${isImageMode ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' : 'bg-green-500/10 text-green-400 border-green-500/20'} rounded-full text-[10px] font-bold flex items-center uppercase tracking-[0.2em] border transition-all duration-500 shadow-sm`}>
              <span className={`w-1.5 h-1.5 ${isImageMode ? 'bg-yellow-400' : 'bg-green-500'} rounded-full mr-2 animate-pulse`} />
              {isImageMode ? 'Vision Engine Active' : 'System Operational'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8">
               <div className="relative group animate-float">
                  <div className="absolute -inset-6 bg-yellow-400/10 rounded-full blur-3xl group-hover:bg-yellow-400/20 transition-all duration-1000"></div>
                  <div className="w-24 h-24 banana-gradient rounded-[2.2rem] flex items-center justify-center rotate-12 shadow-[0_20px_50px_rgba(250,204,21,0.2)] relative z-10 transition-all duration-700 hover:rotate-0 hover:scale-110">
                    <Zap className="text-black" fill="black" size={48} />
                  </div>
               </div>
               <div className="animate-reveal-blur" style={{ animationDelay: '0.2s' }}>
                 <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">How can I assist <span className="banana-text-gradient italic">Nano</span>?</h2>
                 <p className="text-white/40 leading-relaxed text-sm md:text-lg">
                   Experience the next generation of multimodal intelligence. Create visuals, solve code, or explore data.
                 </p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {[
                    { text: 'Visualize a cyberpunk city', icon: <Wand2 size={16} /> },
                    { text: 'Imagine a robotic honeybee', icon: <Wand2 size={16} /> },
                    { text: 'Explain quantum computing', icon: <Zap size={16} /> },
                    { text: 'Code a glassmorphic button', icon: <LayoutGrid size={16} /> }
                  ].map((suggestion, idx) => (
                    <button 
                      key={suggestion.text} 
                      onClick={() => { 
                        if (suggestion.text.includes('Visualize') || suggestion.text.includes('Imagine')) setIsImageMode(true);
                        setInputValue(suggestion.text); 
                      }} 
                      className="p-5 bg-white/5 border border-white/10 rounded-[1.5rem] hover:bg-white/10 hover:border-yellow-400/30 transition-all duration-500 text-left group flex items-center space-x-4 animate-reveal-blur hover:-translate-y-1"
                      style={{ animationDelay: `${0.3 + idx * 0.1}s` }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-yellow-400 group-hover:bg-yellow-400/10 transition-all duration-500">
                        {suggestion.icon}
                      </div>
                      <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{suggestion.text}</p>
                    </button>
                  ))}
               </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble 
              key={msg.id} 
              message={msg} 
              onUpdateMessage={handleUpdateMessage} 
            />
          ))}
          <div ref={scrollRef} className="h-4" />
        </div>

        <div className="p-4 md:p-8 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent sticky bottom-0 z-20">
          <div className="max-w-4xl mx-auto relative group">
            {isListening && (
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 glass px-5 py-2.5 rounded-full border border-yellow-400/40 animate-mic-pulse flex items-center space-x-3 shadow-xl">
                <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_10px_#facc15]" />
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-[0.2em]">Nano is Listening</span>
              </div>
            )}
            
            {pendingImage && (
              <div className="mb-4 relative inline-block animate-elastic-reveal">
                <div className="absolute -inset-1 banana-gradient rounded-2xl blur-sm opacity-50"></div>
                <img src={pendingImage} alt="Pending upload" className="w-24 h-24 object-cover rounded-2xl border-2 border-yellow-400/50 shadow-2xl relative z-10 hover:scale-105 transition-transform" />
                <button onClick={() => setPendingImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors z-20 hover:scale-110 active:scale-90">
                  <X size={14} />
                </button>
              </div>
            )}
            
            <div className={`absolute -inset-1.5 transition-all duration-1000 rounded-[2.2rem] blur-2xl opacity-0 ${isImageMode ? 'bg-yellow-400/20 opacity-100' : isListening ? 'bg-yellow-400/10 opacity-100' : 'group-focus-within:opacity-10 group-focus-within:bg-white/20'}`}></div>
            <div className={`relative glass rounded-[2.2rem] flex items-center p-3 border transition-all duration-700 ${isImageMode ? 'border-yellow-400/40 bg-yellow-400/[0.04]' : isListening ? 'border-yellow-400/30' : 'border-white/10'}`}>
              <div className="flex items-center pr-3 border-r border-white/5 mr-3 space-x-1">
                <button 
                  onClick={() => setIsImageMode(!isImageMode)} 
                  className={`p-3 rounded-2xl transition-all duration-500 flex items-center space-x-2 ${isImageMode ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/30 scale-105' : 'text-white/40 hover:text-yellow-400 hover:bg-white/5'}`}
                  title="Toggle Image Generation Mode"
                >
                  <Wand2 size={22} className={isImageMode ? 'animate-spin-slow' : ''} />
                  {isImageMode && <span className="text-[10px] font-bold uppercase tracking-tighter transition-all">Visual Mode</span>}
                </button>
                <button 
                  onClick={toggleListening}
                  className={`p-3 rounded-2xl transition-all duration-500 ${isListening ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/40 scale-110' : 'text-white/40 hover:text-yellow-400 hover:bg-white/5'}`}
                  title="Speech to Text"
                >
                  <Mic size={22} className={isListening ? 'animate-pulse' : ''} />
                </button>
                <button onClick={handleCameraClick} className="p-3 text-white/40 hover:text-yellow-400 hover:bg-white/5 rounded-2xl transition-all duration-500">
                  <Camera size={22} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
              </div>
              
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isImageMode ? "What shall I visualize for you?..." : pendingImage ? "Describe this image..." : isListening ? "" : "Command Nano Banana..."}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-white/20 px-4 py-3 text-sm"
              />

              <button 
                onClick={handleSendMessage}
                disabled={(!inputValue.trim() && !pendingImage) || isTyping}
                className={`p-4 rounded-2xl transition-all duration-500 flex items-center justify-center ${
                  (inputValue.trim() || pendingImage) && !isTyping
                    ? 'banana-gradient text-black shadow-[0_10px_30px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95' 
                    : 'bg-white/5 text-white/10'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
            <div className="mt-4 text-center">
              <p className="text-[9px] text-white/10 uppercase tracking-[0.5em] font-bold animate-reveal-blur" style={{ animationDelay: '1s' }}>Multimodal Protocol • Gemini 3 Flash v1.2</p>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative background glows */}
      <div className="fixed top-[-15%] left-[-15%] w-[50%] h-[50%] bg-yellow-400/[0.02] rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-yellow-600/[0.02] rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
    </div>
  );
};

export default App;
