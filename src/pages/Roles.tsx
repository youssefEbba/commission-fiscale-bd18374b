import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ROLE_OPTIONS, ROLE_LABELS, permissionApi, PermissionDto } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, Check, X, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Roles = () => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(ROLE_OPTIONS[0].value);
  const [allPermissions, setAllPermissions] = useState<PermissionDto[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = async (role: string) => {
    setLoading(true);
    try {
      const [all, byRole] = await Promise.all([
        permissionApi.listAll(),
        permissionApi.getByRole(role),
      ]);
      setAllPermissions(all);
      setRolePermissions(new Set(byRole.map((p) => p.code)));
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedRole);
  }, [selectedRole]);

  const handleToggle = async (code: string, checked: boolean) => {
    setToggling(code);
    try {
      if (checked) {
        await permissionApi.assign(selectedRole, code);
        setRolePermissions((prev) => new Set([...prev, code]));
      } else {
        await permissionApi.revoke(selectedRole, code);
        setRolePermissions((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      }
      toast({ title: checked ? "Permission attribuée" : "Permission révoquée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  // Group permissions by processus prefix (e.g. "P1", "P2", "ADMIN")
  const groupPermissions = (perms: PermissionDto[]) => {
    const groups: Record<string, PermissionDto[]> = {};
    for (const p of perms) {
      const key = p.processus || "GÉNÉRAL";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  };

  const filtered = allPermissions.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = groupPermissions(filtered);
  const assignedCount = rolePermissions.size;
  const totalCount = allPermissions.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Gestion des permissions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Attribuez ou révoquez les permissions par rôle ({totalCount} permissions disponibles)
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Role selector */}
          <Card className="lg:w-72 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Rôles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0.5 px-2 pb-3">
                {ROLE_OPTIONS.map((role) => {
                  const active = selectedRole === role.value;
                  return (
                    <button
                      key={role.value}
                      onClick={() => setSelectedRole(role.value)}
                      className={`w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Badge
                        variant={active ? "outline" : "secondary"}
                        className={`text-[10px] shrink-0 ${active ? "border-primary-foreground/40 text-primary-foreground" : ""}`}
                      >
                        {role.value}
                      </Badge>
                      <span className="truncate">{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Permissions panel */}
          <Card className="flex-1 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Permissions – {ROLE_LABELS[selectedRole] || selectedRole}
                  <Badge variant="secondary" className="text-xs">
                    {assignedCount} / {totalCount}
                  </Badge>
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : allPermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune permission trouvée dans le système.
                </p>
              ) : (
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-6">
                    {Object.entries(grouped).map(([group, perms]) => (
                      <div key={group}>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
                          {group}
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10"></TableHead>
                              <TableHead className="text-xs">Code</TableHead>
                              <TableHead className="text-xs">Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {perms.map((perm) => {
                              const checked = rolePermissions.has(perm.code);
                              const isToggling = toggling === perm.code;
                              return (
                                <TableRow key={perm.code} className="group">
                                  <TableCell className="py-1.5">
                                    {isToggling ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(v) => handleToggle(perm.code, !!v)}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1.5">
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                      {perm.code}
                                    </code>
                                  </TableCell>
                                  <TableCell className="py-1.5 text-sm text-muted-foreground">
                                    {perm.description}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Roles;
