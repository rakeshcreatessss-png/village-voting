import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export function AdminDashboard() {
  const [candidates, setCandidates] = useState<any[]>([])
  const [totalVotes, setTotalVotes] = useState(0)
  const [electionActive, setElectionActive] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    checkAdmin()
    fetchResults()
    fetchElectionStatus()
  }, [])

  const checkAdmin = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      navigate('/admin')
    }
  }

  const fetchElectionStatus = async () => {
    const { data } = await supabase
      .from('election_settings')
      .select('is_active')
      .eq('id', 1)
      .single()

    if (data) {
      setElectionActive(data.is_active)
    }
  }

  const startElection = async () => {
  const { data, error } = await supabase
    .from("election_settings")
    .update({ is_active: true })
    .eq("id", 1)
    .select();

  console.log(data);
  console.log(error);

  if (error) {
    alert(error.message);
    return;
  }

  setElectionActive(true);
  alert("Election Started Successfully");
};

  const stopElection = async () => {
    await supabase
      .from('election_settings')
      .update({ is_active: false })
      .eq('id', 1)

    setElectionActive(false)
    alert('Election Stopped')
  }

  const fetchResults = async () => {
    const { data: candidateData } = await supabase
      .from('candidates')
      .select('*')

    const { data: voteData } = await supabase
      .from('votes')
      .select('*')

    if (candidateData && voteData) {
      setTotalVotes(voteData.length)

      const results = candidateData.map(candidate => {
        const count = voteData.filter(
          vote => vote.candidate_id === candidate.id
        ).length

        return {
          ...candidate,
          voteCount: count,
        }
      })

      setCandidates(results)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">

      <div className="flex justify-between items-center mb-8 max-w-5xl mx-auto">

        <h1 className="text-3xl font-bold">
          Admin Dashboard
        </h1>

        <div className="flex gap-3">

          <button
            onClick={startElection}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold"
          >
            ▶ Start Election
          </button>

          <button
            onClick={stopElection}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold"
          >
            ■ Stop Election
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold"
>
            ⬅ Back to Home
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold"
          >
            Logout
          </button>

        </div>

      </div>

      <div className="max-w-5xl mx-auto bg-gray-800 rounded-lg p-6 mb-6">

        <h2 className="text-xl mb-3">
          Election Status :
          {electionActive ? (
            <span className="text-green-400 font-bold">
              {' '}🟢 ACTIVE
            </span>
          ) : (
            <span className="text-red-400 font-bold">
              {' '}🔴 CLOSED
            </span>
          )}
        </h2>

        <h2 className="text-xl text-gray-300">
          Total Votes Cast
        </h2>

        <p className="text-4xl font-bold text-green-400 mt-2">
          {totalVotes}
        </p>

      </div>

      <div className="max-w-5xl mx-auto bg-gray-800 rounded-lg p-6">

        <h2 className="text-2xl font-bold mb-5">
          Candidate Results
        </h2>

        <div className="space-y-4">

          {candidates.map(candidate => (

            <div
              key={candidate.id}
              className="flex justify-between bg-gray-700 rounded p-4"
            >

              <div>

                <h3 className="text-lg font-bold">
                  {candidate.name}
                </h3>

                <p className="text-gray-400">
                  {candidate.party_name}
                </p>

              </div>

              <div className="text-blue-400 text-2xl font-bold">
                {candidate.voteCount}
              </div>

            </div>

          ))}

        </div>

      </div>

    </div>
  )
}