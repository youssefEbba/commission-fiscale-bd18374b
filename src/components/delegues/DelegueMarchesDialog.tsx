import { useEffect, useState } from "react";
import { delegueApi, DelegueDto, DelegueMarcheDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText } from "lucide-react";

interface Props {
  delegue: DelegueDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DelegueMarchesDialog = ({ delegue, open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [marches, setMarches] = useState<DelegueMarcheDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && delegue) {
      setLoading(true);
      delegueApi.getMarches(delegue.id)
        .then(setMarches)
        .catch(() => toast({ title: "Erreur", description: "Impossible de charger les marchés", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [open, delegue?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Marchés de {delegue?.nomComplet}
          </DialogTitle>
          <DialogDescription>Liste des marchés auxquels ce délégué est rattaché</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : marches.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun marché rattaché</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marches.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">#{m.id}</TableCell>
                  <TableCell>{m.reference || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.objet || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{m.statut || "—"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DelegueMarchesDialog;
