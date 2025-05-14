import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function HomePage() {
  const selectedMovie = "Interstellar"; // This will eventually come from the admin panel
  const theaters = [
    {
      name: "AMC River East 21",
      slots: ["6:00 PM", "7:30 PM", "9:00 PM"]
    },
    {
      name: "Regal City North",
      slots: ["5:45 PM", "8:15 PM"]
    },
    {
      name: "Music Box Theatre",
      slots: ["6:30 PM", "9:15 PM"]
    }
  ];

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-6">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-2">🎬 Movie Club</h1>
        <p className="text-zinc-400">Plan and coordinate your next movie outing</p>
      </header>

      <section className="max-w-3xl mx-auto">
        {/* Admin Selected Movie Display */}
        <div className="mb-8 bg-zinc-800 p-6 rounded-xl shadow-lg text-center">
          <h2 className="text-2xl font-semibold mb-2">This Week's Movie</h2>
          <p className="text-xl text-indigo-400">{selectedMovie}</p>
        </div>

        {/* Ranked Choice Theater Voting */}
        <div className="mb-8 bg-zinc-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Vote for Showtimes</h2>
          <p className="text-zinc-400 mb-4">Select your top 3 theater + time combos in ranked order:</p>
          <div className="space-y-4">
            {[1, 2, 3].map((rank) => (
              <div key={rank} className="bg-zinc-700 p-4 rounded">
                <label className="block mb-2 font-medium">#{rank} Choice</label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a showtime" />
                  </SelectTrigger>
                  <SelectContent>
                    {theaters.map((theater) => (
                      theater.slots.map((slot) => (
                        <SelectItem key={`${theater.name}-${slot}`} value={`${theater.name} - ${slot}`}>
                          {theater.name} — {slot}
                        </SelectItem>
                      ))
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Group Voting Summary */}
        <div className="mb-8 bg-zinc-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Friend Votes</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Alice: #1 AMC River East 21 - 7:30 PM</span>
              <span className="text-green-400">👍</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Bob: #1 Music Box Theatre - 9:15 PM</span>
              <span className="text-green-400">👍</span>
            </div>
          </div>
        </div>

        {/* Final Decision */}
        <div className="text-center">
          <Button className="text-lg">Confirm Movie Night</Button>
        </div>
      </section>
    </main>
  );
}
