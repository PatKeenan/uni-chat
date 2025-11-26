import { Check, ChevronDown, Paperclip, Send } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "@/client/stores/chat-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/client/auth";
import { useStarredModels } from "@/client/hooks/use-models";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const currentModel = useChatStore((state) => state.model);
  const setModel = useChatStore((state) => state.setModel);
  const session = useSession();

  const [open, setOpen] = useState(false);
  const { data: starredModels } = useStarredModels(
    session?.data?.user?.id || ""
  );
  const { input, setInput } = useChatStore();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  return (
    <div className="bg-background p-4 animate-fade-slide-up delay-300">
      <form onSubmit={onSubmit} className=" mx-auto space-y-3">
        {/* Model Selector */}
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                size="sm"
              >
                <span className="truncate">{currentModel}</span>
                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search models..." />
                <CommandList>
                  <CommandEmpty>No models found.</CommandEmpty>
                  <CommandGroup heading="Starred Models">
                    {starredModels?.map((model) => (
                      <CommandItem
                        key={model.modelId}
                        value={model.modelId}
                        onSelect={() => {
                          // Pass full model metadata for capability detection
                          setModel(model.modelId, model.metadata);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            currentModel === model.modelId
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm">{model.modelName}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.provider}
                          </span>
                        </div>
                        {model.contextLength && (
                          <Badge variant="secondary" className="ml-2">
                            {(model.contextLength / 1000).toFixed(0)}k
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Input Area with elevated card style */}
        <div className="input-elevated flex items-center gap-4 p-4">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 opacity-60 hover:opacity-100 transition-opacity rounded-lg"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message Muse..."
            className="flex-1 min-h-[24px] max-h-[200px] bg-white border-0 active:border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 focus:border-0  resize-none active:ring-0 active:ring-offset-0 focus:shadow-none focus-visible:shadow-none focus:ring-offset-0 "
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="btn-warm h-11 w-11 rounded-xl shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {/* Keyboard hints */}
        <div className="flex gap-6 justify-center text-xs text-muted-foreground">
          <span>
            <kbd className="kbd">Enter</kbd> to send
          </span>
          <span>
            <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd>{" "}
            for new line
          </span>
        </div>
      </form>
    </div>
  );
}
