import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Role = "CASEADMIN" | "DISCLOSER" | "DISCLOSEE" | "REVIEWER";

const roleLabels: Record<Role, string> = {
  CASEADMIN: "Case Admin",
  DISCLOSER: "Discloser", 
  DISCLOSEE: "Disclosee",
  REVIEWER: "Reviewer",
};

const roleColors: Record<Role, string> = {
  CASEADMIN: "bg-red-100 text-red-800",
  DISCLOSER: "bg-blue-100 text-blue-800",
  DISCLOSEE: "bg-green-100 text-green-800",
  REVIEWER: "bg-yellow-100 text-yellow-800",
};

interface MultiRoleSelectorProps {
  selectedRoles: Role[];
  onRolesChange: (roles: Role[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiRoleSelector({
  selectedRoles,
  onRolesChange,
  placeholder = "Select roles...",
  disabled = false
}: MultiRoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const allRoles: Role[] = ["CASEADMIN", "DISCLOSER", "DISCLOSEE", "REVIEWER"];

  const handleToggleRole = (role: Role) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter(r => r !== role));
    } else {
      onRolesChange([...selectedRoles, role]);
    }
  };

  const handleRemoveRole = (roleToRemove: Role) => {
    onRolesChange(selectedRoles.filter(role => role !== roleToRemove));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedRoles.length === 0 ? placeholder : `${selectedRoles.length} role(s) selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search roles..." />
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {allRoles.map((role) => (
                <CommandItem
                  key={role}
                  onSelect={() => handleToggleRole(role)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedRoles.includes(role) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {roleLabels[role]}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Display selected roles as badges */}
      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRoles.map((role) => (
            <Badge
              key={role}
              variant="secondary"
              className={cn("cursor-pointer", roleColors[role])}
              onClick={() => handleRemoveRole(role)}
            >
              {roleLabels[role]}
              <span className="ml-1 text-xs">×</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}