import { Check, ChevronDown, Send } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "@/chat-store";
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
import { useStarredModels } from "@/lib/client/hooks/use-models";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const currentModel = useChatStore((state) => state.model);
  const setModel = useChatStore((state) => state.setModel);

  const [open, setOpen] = useState(false);
  const { data: starredModels } = useStarredModels();
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

  const selectedModelData = starredModels?.find(
    (m) => m.modelId === currentModel
  );

  console.log({ currentModel });

  return (
    <div className="border-t bg-background p-4">
      <form onSubmit={onSubmit} className="space-y-2">
        {/* Model Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Model:</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[300px] justify-between"
              >
                <span className="truncate">{currentModel}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                          setModel(model.modelId);
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

        {/* Input Area */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-[60px] w-[60px]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
