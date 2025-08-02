import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { apiRequest } from "@/lib/queryClient";
import type { LegalOrganization } from "@shared/schema";

interface LegalOrganizationSelectorProps {
  value?: number | null;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function LegalOrganizationSelector({
  value,
  onValueChange,
  placeholder = "Select organization...",
  className,
}: LegalOrganizationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<LegalOrganization[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest("/api/legal-organizations");
      setOrganizations(data);
    } catch (error) {
      console.error("Failed to load organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchOrganizations = async (query: string) => {
    if (!query.trim()) {
      loadOrganizations();
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiRequest(`/api/legal-organizations/search?q=${encodeURIComponent(query)}`);
      setOrganizations(data);
    } catch (error) {
      console.error("Failed to search organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewOrganization = async (name: string) => {
    try {
      const newOrg = await apiRequest("/api/legal-organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      
      setOrganizations(prev => [newOrg, ...prev]);
      onValueChange(newOrg.id);
      setOpen(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Failed to create organization:", error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchOrganizations(searchQuery);
      } else {
        loadOrganizations();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectedOrganization = organizations.find(org => org.id === value);
  const exactMatch = organizations.find(org => 
    org.name.toLowerCase() === searchQuery.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedOrganization ? selectedOrganization.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search organizations..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                "Searching..."
              ) : (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    No organizations found.
                  </p>
                  {searchQuery && !exactMatch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => createNewOrganization(searchQuery)}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create "{searchQuery}"
                    </Button>
                  )}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => {
                    onValueChange(org.id === value ? null : org.id);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === org.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{org.name}</span>
                    {org.location && org.location !== "N/A" && (
                      <span className="text-xs text-muted-foreground">
                        {org.location}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              
              {searchQuery && !exactMatch && !isLoading && (
                <CommandItem onSelect={() => createNewOrganization(searchQuery)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create "{searchQuery}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}