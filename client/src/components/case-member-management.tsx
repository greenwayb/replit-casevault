import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Mail, Users, Shield, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Role, User, CaseUser, CaseInvitation } from "@shared/schema";

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

const inviteUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["CASEADMIN", "DISCLOSER", "DISCLOSEE", "REVIEWER"]),
});

const addExistingUserSchema = z.object({
  userId: z.string().min(1, "Please select a user"),
  role: z.enum(["CASEADMIN", "DISCLOSER", "DISCLOSEE", "REVIEWER"]),
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;
type AddExistingUserForm = z.infer<typeof addExistingUserSchema>;

interface CaseMemberManagementProps {
  caseId: number;
  currentUserRole?: Role;
}

export function CaseMemberManagement({ caseId, currentUserRole }: CaseMemberManagementProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canManageMembers = currentUserRole === "CASEADMIN";

  // Fetch case members
  const { data: members = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/cases", caseId, "members"],
    enabled: !!caseId,
  });

  // Fetch case invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<CaseInvitation[]>({
    queryKey: ["/api/cases", caseId, "invitations"],
    enabled: !!caseId && canManageMembers,
  });

  // Fetch all users for adding existing users
  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: canManageMembers,
  });

  const inviteForm = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      role: "REVIEWER",
    },
  });

  const addUserForm = useForm<AddExistingUserForm>({
    resolver: zodResolver(addExistingUserSchema),
    defaultValues: {
      userId: "",
      role: "REVIEWER",
    },
  });

  // Mutation to invite user by email
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserForm) => {
      const response = await fetch(`/api/cases/${caseId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send invitation");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "The user will receive an email with instructions to join the case.",
      });
      setInviteDialogOpen(false);
      inviteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "invitations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to add existing user
  const addUserMutation = useMutation({
    mutationFn: async (data: AddExistingUserForm) => {
      const response = await fetch(`/api/cases/${caseId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User added successfully",
        description: "The user has been added to the case.",
      });
      setAddUserDialogOpen(false);
      addUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to remove user
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/cases/${caseId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove user");
      }
    },
    onSuccess: () => {
      toast({
        title: "User removed",
        description: "The user has been removed from the case.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const existingUserIds = members.map((member: any) => member.userId);
  const availableUsers = allUsers.filter((user: User) => !existingUserIds.includes(user.id));

  if (membersLoading) {
    return <div>Loading case members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Case Members</h3>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        
        {canManageMembers && (
          <div className="flex gap-2">
            <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Existing User</DialogTitle>
                  <DialogDescription>
                    Add an existing user to this case with a specific role.
                  </DialogDescription>
                </DialogHeader>
                <Form {...addUserForm}>
                  <form onSubmit={addUserForm.handleSubmit((data) => addUserMutation.mutate(data))}>
                    <div className="space-y-4">
                      <FormField
                        control={addUserForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>User</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableUsers.map((user: User) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName} ({user.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addUserForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="CASEADMIN">Case Admin</SelectItem>
                                <SelectItem value="DISCLOSER">Discloser</SelectItem>
                                <SelectItem value="DISCLOSEE">Disclosee</SelectItem>
                                <SelectItem value="REVIEWER">Reviewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter className="mt-6">
                      <Button type="submit" disabled={addUserMutation.isPending}>
                        {addUserMutation.isPending ? "Adding..." : "Add User"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite User to Case</DialogTitle>
                  <DialogDescription>
                    Send an email invitation to invite someone to join this case.
                  </DialogDescription>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form onSubmit={inviteForm.handleSubmit((data) => inviteUserMutation.mutate(data))}>
                    <div className="space-y-4">
                      <FormField
                        control={inviteForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="user@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={inviteForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="CASEADMIN">Case Admin</SelectItem>
                                <SelectItem value="DISCLOSER">Discloser</SelectItem>
                                <SelectItem value="DISCLOSEE">Disclosee</SelectItem>
                                <SelectItem value="REVIEWER">Reviewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter className="mt-6">
                      <Button type="submit" disabled={inviteUserMutation.isPending}>
                        {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Organization</TableHead>
              {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member: any) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.user.firstName} {member.user.lastName}
                </TableCell>
                <TableCell>{member.user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={roleColors[member.role as Role]}>
                    {roleLabels[member.role as Role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.user.legalOrganization?.name || "Not specified"}
                </TableCell>
                {canManageMembers && (
                  <TableCell className="text-right">
                    {member.role !== "CASEADMIN" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUserMutation.mutate(member.userId)}
                        disabled={removeUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManageMembers && invitations.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium">Pending Invitations</h4>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation: CaseInvitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {roleLabels[invitation.role as Role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invitation.status === 'pending' ? 'secondary' : 'default'}>
                        {invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}