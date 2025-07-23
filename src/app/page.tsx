import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden">
      {/* Hero Section */}
      <section className="hero flex-grow">
        <div className="hero-content text-center">
          <div className="max-w-2xl">
            <h1 className="text-6xl font-bold text-primary">Masterwork</h1>
            <h2 className="text-4xl font-bold text-secondary mt-2">Your Ultimate Competitive Hub</h2>
            <p className="py-6 text-lg text-base-content/80">
              Forge your team, dominate the queue, and climb the leaderboards. The premier platform for organized 5v5s and community-driven competition.
            </p>
            <Link href="/login" className="btn btn-primary btn-lg">
              Launch Your Legacy
            </Link>
          </div>
        </div>
      </section>

      {/* Features Preview Section */}
      <section id="features" className="py-8 bg-base-100/50">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-info">Core Features</h2>
        </div>
        <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Feature Card 1 */}
              <div className="card bg-base-200/50 text-center transition-all duration-300 hover:bg-base-300/70 card-bordered border-primary/10 hover:border-primary/50">
                <div className="card-body p-4 items-center">
                  <h3 className="card-title text-lg text-info">Team Management</h3>
                  <p className="text-sm text-base-content/60">
                    Build your roster, assign roles, and challenge other teams.
                  </p>
                </div>
              </div>
              
              {/* Feature Card 2 */}
              <div className="card bg-base-200/50 text-center transition-all duration-300 hover:bg-base-300/70 card-bordered border-primary/10 hover:border-primary/50">
                <div className="card-body p-4 items-center">
                  <h3 className="card-title text-lg text-info">Dynamic Queue</h3>
                  <p className="text-sm text-base-content/60">
                    Jump into solo or party queues for competitive matches.
                  </p>
                </div>
              </div>
              
              {/* Feature Card 3 */}
              <div className="card bg-base-200/50 text-center transition-all duration-300 hover:bg-base-300/70 card-bordered border-primary/10 hover:border-primary/50">
                <div className="card-body p-4 items-center">
                  <h3 className="card-title text-lg text-info">Live Leaderboards</h3>
                  <p className="text-sm text-base-content/60">
                    Track your rank, win rates, and champion stats in real-time.
                  </p>
                </div>
              </div>
            </div>
        </div>
      </section>
    </main>
  );
}
