import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Lightbulb,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";

/**
 * Dashboard Index Route
 * Beautiful landing page after sign-in with quick actions
 */
export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    return { hasChats: false };
  },
  component: DashboardIndex,
});

function DashboardIndex() {
  const quickActions = [
    {
      icon: MessageSquarePlus,
      title: "Start a conversation",
      description: "Begin a new chat with your favorite AI model",
      href: "/dashboard/new",
      accent: true,
    },
    {
      icon: Sparkles,
      title: "Creative writing",
      description: "Get help with stories, poems, or scripts",
      href: "/dashboard/new",
    },
    {
      icon: BookOpen,
      title: "Research & learn",
      description: "Explore topics and expand your knowledge",
      href: "/dashboard/new",
    },
    {
      icon: Lightbulb,
      title: "Brainstorm ideas",
      description: "Generate and refine creative concepts",
      href: "/dashboard/new",
    },
  ];

  return (
    <div className="flex flex-1 items-center justify-center p-8 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(196, 112, 75, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(196, 112, 75, 0.03) 0%, transparent 40%)
          `,
        }}
      />

      <div className="max-w-[36rem] w-full relative z-10">
        {/* Floating orbs */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 pointer-events-none">
          <div className="orb orb-primary absolute top-4 left-6 w-28 h-28 animate-float float-delay-1" />
          <div className="orb orb-secondary absolute -top-2 right-2 w-16 h-16 animate-float float-delay-2" />
          <div className="orb orb-tertiary absolute bottom-2 left-16 w-10 h-10 animate-float float-delay-3" />
        </div>

        {/* Content */}
        <div className="text-center pt-36 animate-fade-scale-in">
          {/* Heading */}
          <h1 className="font-serif text-4xl md:text-5xl font-normal tracking-tight mb-4 animate-fade-slide-down delay-100">
            Welcome <em className="italic text-warm-500">back</em>
          </h1>
          <p className="text-muted-foreground text-lg mb-12 max-w-[36rem] mx-auto animate-fade-slide-down delay-150">
            Ready to think, create, and discover? Pick up where you left off or
            start something new.
          </p>

          {/* Quick action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {quickActions.map((action, index) => (
              <Link
                key={action.title}
                to={action.href}
                className={`
                  group relative p-5 rounded-2xl text-left transition-all duration-200
                  animate-fade-slide-up
                  ${
                    action.accent
                      ? "bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg hover:-translate-y-1"
                      : "bg-card border border-border hover:border-warm-300 hover:shadow-md hover:-translate-y-0.5"
                  }
                `}
                style={{ animationDelay: `${200 + index * 75}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`
                    p-2.5 rounded-xl
                    ${action.accent ? "bg-background/10" : "bg-warm-100"}
                  `}
                  >
                    <action.icon
                      className={`
                      w-5 h-5
                      ${action.accent ? "text-background" : "text-warm-600"}
                    `}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`
                      font-medium mb-1 flex items-center gap-2
                      ${action.accent ? "text-background" : "text-foreground"}
                    `}
                    >
                      {action.title}
                      <ArrowRight
                        className={`
                        w-4 h-4 opacity-0 -translate-x-2 transition-all duration-200
                        group-hover:opacity-100 group-hover:translate-x-0
                        ${action.accent ? "text-background/70" : "text-warm-500"}
                      `}
                      />
                    </h3>
                    <p
                      className={`
                      text-sm
                      ${action.accent ? "text-background/70" : "text-muted-foreground"}
                    `}
                    >
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 justify-center animate-fade-slide-up delay-500">
            {[
              "Write an email",
              "Explain code",
              "Plan a trip",
              "Summarize text",
            ].map((suggestion, i) => (
              <Link
                key={suggestion}
                to="/dashboard/new"
                className="chip"
                style={{ animationDelay: `${550 + i * 50}ms` }}
              >
                {suggestion}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
