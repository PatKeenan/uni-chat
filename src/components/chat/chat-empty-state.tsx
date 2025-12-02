interface ChatEmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function ChatEmptyState({ onSuggestionClick }: ChatEmptyStateProps) {
  const suggestions = [
    "Help me write",
    "Explain a concept",
    "Brainstorm ideas",
    "Analyze data",
  ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 py-16 animate-fade-scale-in delay-200 max-w-[480px]">
      {/* Floating orbs */}
      <div className="relative w-48 h-48 mb-8">
        <div className="orb orb-primary absolute top-8 left-8 w-36 h-36 animate-float float-delay-1" />
        <div className="orb orb-secondary absolute top-2 right-5 w-20 h-20 animate-float float-delay-2" />
        <div className="orb orb-tertiary absolute bottom-5 left-12 w-12 h-12 animate-float float-delay-3" />
      </div>

      {/* Typography */}
      <h1 className="font-serif text-4xl font-normal tracking-tight mb-4 text-center">
        What shall we <em className="italic text-warm-500">explore</em> today?
      </h1>
      <p className="text-muted-foreground text-lg text-center leading-relaxed mb-10">
        I'm here to help you think, create, and discover. Share an idea, ask a
        question, or let's work through a challenge together.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((text, index) => (
          <button
            key={text}
            type="button"
            onClick={() => onSuggestionClick(text)}
            className="chip animate-fade-slide-up"
            style={{ animationDelay: `${400 + index * 100}ms` }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
