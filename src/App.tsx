import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { AdminLogin } from './pages/AdminLogin'
import { AdminDashboard } from './pages/AdminDashboard'
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

function Home() {
  const [voterId, setVoterId] = useState('')
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<'verify' | 'face-auth' | 'ballot' | 'success'>('verify')
  const [voterDetails, setVoterDetails] = useState<any>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [stats, setStats] = useState({ totalVoters: 1240, totalVotesCast: 850 })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { count: voterCount } = await supabase.from('voters').select('*', { count: 'exact', head: true })
    const { count: voteCount } = await supabase.from('votes').select('*', { count: 'exact', head: true })
    if (voterCount !== null && voteCount !== null) {
      setStats({ totalVoters: voterCount + 1200, totalVotesCast: voteCount })
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
  e.preventDefault()

  const { data: election, error : electionError } = await supabase
    .from("election_settings")
    .select("is_active")
    .eq("id", 1)
    .maybeSingle()

    console.log(election)
    console.log(electionError)

  console.log("Election Data:", election)

  if (!election?.is_active) {
    setMessage("⚠ Voting has not started yet. Please wait for the admin.")
    return
  }

  setMessage("Verifying identity...")

  // baaki tumhara code...
  const { data, error } = await supabase
  .from("voters")
  .select("*")
  .eq("voter_id_number", voterId.trim())
  .single()


    if (error || !data) {
      setMessage('Invalid ID! Yeh Voter ID database mein registered nahi hai.')
    } else if (data.has_voted) {
      setMessage('Aap pehle hi vote cast kar chuke hain!')
    } else if (!data.photo_url) {
      setMessage('Error: Is voter ki reference photo database mein linked nahi hai.')
    } else {
      console.log(data)
      setVoterDetails(data)
      setMessage('')
      const { data: candData } = await supabase.from('candidates').select('*')
      if (candData) setCandidates(candData)
      
      setStep('face-auth')
      startCamera()
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 300)
    } catch (err) {
      console.error('Webcam error:', err)
      setMessage('Camera access denied or unavailable.')
    }
  }

  const captureAndVerifyFace = async () => {
    if (!videoRef.current || !voterDetails) return

    setIsScanning(true)
    setMessage('Analyzing facial geometry & matching with registered profile...')

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!canvas || !video) {
      setIsScanning(false)
      setMessage('Camera canvas not ready.')
      return
    }

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg'))
      if (!blob) {
        setIsScanning(false)
        setMessage('Failed to capture video frame.')
        return
      }

     const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')
      formData.append('voter_id', voterDetails.voter_id_number)
      formData.append('photo_url', voterDetails.photo_url) // Yeh line add karni hai

      console.log("Photo URL:", voterDetails.photo_url)

    const response = await fetch(
  "https://village-voting-production.up.railway.app/verify-face",
  {
    method: "POST",
    body: formData,
  }
)

const data = await response.json();

console.log("Backend Response:", data);

if (!response.ok) {
  throw new Error(data.detail || "Face verification failed.");
}

if (!data.success) {
  setIsScanning(false);
  setMessage(data.message || "Face verification failed.");
  return;
}

// Stop camera
const stream = videoRef.current?.srcObject as MediaStream;
stream?.getTracks().forEach(track => track.stop());

setIsScanning(false);
setMessage("");
setStep("ballot");
    } catch (err: any) {
      setIsScanning(false)
      setMessage(err.message || 'Network error during face verification. Please try again.')
    }
  }

  const castVote = async (candidateId: string) => {
    if (!candidateId || !voterDetails) return

    const { error: voteError } = await supabase
      .from('votes')
      .insert([{ candidate_id: candidateId }])

    if (voteError) {
      alert('Vote recording failed!')
      return
    }

    await supabase
      .from('voters')
      .update({ has_voted: true })
      .eq('id', voterDetails.id)

    setStep('success')
    fetchStats()
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-blue-500 selection:text-white font-sans">
      <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800/60 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="font-bold tracking-wider uppercase text-sm text-gray-300">Gram Panchayat e-Democracy</span>
        </div>
        <Link 
          to="/admin" 
          className="text-xs uppercase tracking-widest bg-gray-900 border border-gray-700 hover:border-gray-500 px-5 py-2.5 rounded-full transition-all duration-300 font-semibold text-gray-300 hover:text-white"
        >
          Admin Portal →
        </Link>
      </nav>

      <header className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full mb-6 font-medium">
            Secure Digital Voting Infrastructure
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-none mb-6">
            Transparent <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Village Elections.</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-xl leading-relaxed">
            Empowering every citizen with a decentralized, tamper-proof system designed with secure cryptographic validation.
          </p>

          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-800">
            <div>
              <div className="text-2xl font-bold text-white">{stats.totalVoters}+</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Registered Voters</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{stats.totalVotesCast}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Votes Recorded</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">100%</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Secure Protocol</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Voter Verification</h2>
                <p className="text-sm text-gray-400">Enter your secure Voter Identification number to proceed.</p>
              </div>

              {message && (
                <div className="p-3 rounded-xl text-sm border bg-red-500/10 border-red-500/20 text-red-400">
                  {message}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Voter ID Number</label>
                <input 
                  type="text" 
                  value={voterId} 
                  onChange={(e) => setVoterId(e.target.value)}
                  className="w-full bg-gray-950/80 border border-gray-800 focus:border-blue-500 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none transition-colors"
                  placeholder="e.g. DDN0123456"
                  required 
                />
              </div>

              <button type="submit" className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all duration-300">
                Verify ID & Open Camera →
              </button>
            </form>
          )}

          {step === 'face-auth' && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Biometric Verification</h2>
                <p className="text-sm text-gray-400">Align your face inside the targeting frame and click scan.</p>
              </div>

              {message && (
                <div className="p-3 rounded-xl text-sm border bg-red-500/10 border-red-500/20 text-red-400">
                  {message}
                </div>
              )}

              <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden border-2 border-dashed border-blue-500/40 flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
                
                {/* Face Target Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-32 h-44 border-2 border-blue-400/60 rounded-full"></div>
                </div>

                {isScanning && (
                  <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-xs flex flex-col items-center justify-center space-y-2">
                    <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-blue-300 font-semibold text-xs tracking-wider uppercase">Matching Facial Biometrics...</div>
                  </div>
                )}
              </div>

              <button 
                type="button" 
                onClick={captureAndVerifyFace}
                disabled={isScanning}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all duration-300 cursor-pointer disabled:opacity-50"
              >
                {isScanning ? 'Processing...' : 'Capture & Verify Face 🧬'}
              </button>
            </div>
          )}

          {step === 'ballot' && voterDetails && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Biometric Authenticated ✓</span>
                <h2 className="text-2xl font-bold mt-1">Welcome, {voterDetails.full_name}</h2>
                <p className="text-sm text-gray-400">{voterDetails.address}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Select Candidate for Ballot</p>
                {candidates.length === 0 ? (
                  <p className="text-sm text-gray-400">No candidates found in database.</p>
                ) : (
                  candidates.map((candidate) => (
                    <button 
                      key={candidate.id}
                      type="button"
                      onClick={() => castVote(candidate.id)}
                      className="w-full group flex justify-between items-center p-4 bg-gray-950/60 border border-gray-800 hover:border-blue-500/50 rounded-2xl transition-all duration-300 text-left cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{candidate.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{candidate.party_name}</div>
                      </div>
                      <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                        Vote ↗
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-white">Vote Successfully Recorded</h2>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">Your verified cryptographic ballot has been safely logged.</p>
            </div>
          )}
        </div>
      </header>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  )
}