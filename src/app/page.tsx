export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#121019] text-[#F2F0EA] flex items-center px-8 md:px-20">
      <div className="max-w-2xl">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
          Shasha AI
        </h1>
        <p className="mt-6 text-lg md:text-xl text-[#F2F0EA]/70 max-w-md leading-relaxed">
          Generate on-brand visuals in seconds — built for teams who need
          production-ready assets without a design queue.
        </p>
        <div className="mt-10">
          <button className="bg-[#E8A33D] text-[#121019] font-medium px-7 py-3 rounded-md hover:bg-[#f0b563] transition-colors">
            Get started
          </button>
        </div>
      </div>
    </main>
  );
}