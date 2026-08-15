/**
 * FaceAttend — Admin Rooms Page (Phase 4)
 * Manage classrooms and labs with GPS geofence configuration.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, RefreshCw, MapPin, Edit2, Trash2,
  Loader2, DoorOpen, Navigation, CheckCircle2,
} from "lucide-react";

import { roomsApi, type Room } from "@/features/academics/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1, "Room name is required"),
  building: z.string().optional(),
  floor: z.coerce.number().int().default(0),
  capacity: z.coerce.number().int().min(1).default(60),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  geofence_radius: z.coerce.number().int().min(10).max(500).default(50),
  status: z.enum(["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE"]).default("ACTIVE"),
});
type FormData = z.infer<typeof schema>;

const STATUS_COLORS: Record<Room["status"], "success" | "secondary" | "warning"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  UNDER_MAINTENANCE: "warning",
};

function RoomModal({
  open,
  onClose,
  editTarget,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: Room;
  onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editTarget
      ? {
          name: editTarget.name,
          building: editTarget.building,
          floor: editTarget.floor,
          capacity: editTarget.capacity,
          latitude: editTarget.latitude ?? "",
          longitude: editTarget.longitude ?? "",
          geofence_radius: editTarget.geofence_radius,
          status: editTarget.status,
        }
      : { floor: 0, capacity: 60, geofence_radius: 50, status: "ACTIVE" },
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    };
    if (isEdit && editTarget) {
      await roomsApi.update(editTarget.id, payload);
    } else {
      await roomsApi.create(payload);
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Room" : "Add Room"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Room Name *</Label>
              <Input
                placeholder="CS-101"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("name")}
              />
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Building</Label>
              <Input
                placeholder="Block A"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("building")}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Floor</Label>
              <Input type="number" className="bg-white/5 border-white/10 text-white h-10" {...register("floor")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Capacity</Label>
              <Input type="number" min={1} className="bg-white/5 border-white/10 text-white h-10" {...register("capacity")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormData["status"])}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="UNDER_MAINTENANCE">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* GPS Geofence Section */}
          <div className="rounded-lg bg-white/3 border border-white/8 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={12} /> GPS Geofence
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setValue("latitude", String(pos.coords.latitude.toFixed(7)));
                      setValue("longitude", String(pos.coords.longitude.toFixed(7)));
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 6000 },
                  );
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-1 transition-colors"
              >
                <Navigation size={11} /> Use My Location
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Latitude</Label>
                <Input
                  placeholder="11.0168"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm font-mono"
                  {...register("latitude")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Longitude</Label>
                <Input
                  placeholder="76.9558"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm font-mono"
                  {...register("longitude")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Geofence Radius (meters)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10} max={500} step={10}
                  className="flex-1 accent-white"
                  {...register("geofence_radius")}
                />
                <span className="text-white text-sm font-mono w-12 text-right">{watch("geofence_radius")}m</span>
              </div>
              <p className="text-slate-600 text-xs">Students must be within this distance to mark attendance. Leave lat/lon empty to skip GPS enforcement.</p>
            </div>

            {watch("latitude") && watch("longitude") && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <CheckCircle2 size={11} /> GPS coordinates set — geofence will be enforced
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm"
              className="bg-white text-slate-900 hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={14} />}
              {isEdit ? "Save Changes" : "Add Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RoomsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Room | undefined>();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rooms", search, statusFilter],
    queryFn: () =>
      roomsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        page_size: 100,
      }),
  });

  const softDelete = useMutation({
    mutationFn: roomsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const rooms = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rooms</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.count ?? 0} rooms · {rooms.filter((r) => r.has_gps).length} with GPS
          </p>
        </div>
        <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Room
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="UNDER_MAINTENANCE">Maintenance</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
          <RefreshCw size={13} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-slate-500" size={20} />
          </div>
        ) : rooms.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 bg-white/3 border border-white/8 rounded-xl">
            <DoorOpen className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No rooms found</p>
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <DoorOpen size={15} className="text-slate-300" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditTarget(room)}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => softDelete.mutate(room.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <h3 className="text-white font-semibold text-sm">{room.name}</h3>
              {room.building && (
                <p className="text-slate-500 text-xs mt-0.5">
                  {room.building} · Floor {room.floor}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <Badge variant={STATUS_COLORS[room.status]} className="text-xs h-5">
                  {room.status === "UNDER_MAINTENANCE" ? "Maintenance" : room.status}
                </Badge>
                <span className="text-slate-500 text-xs">{room.capacity} seats</span>
                {room.has_gps ? (
                  <Navigation size={12} className="text-emerald-400 ml-auto" />
                ) : (
                  <MapPin size={12} className="text-slate-600 ml-auto opacity-30" />
                )}
              </div>
              {room.has_gps && (
                <p className="text-slate-600 text-xs mt-1 flex items-center gap-1">
                  <MapPin size={10} />
                  {room.geofence_radius}m geofence
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <RoomModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["rooms"] })} />
      {editTarget && (
        <RoomModal open={true} onClose={() => setEditTarget(undefined)}
          editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["rooms"] })} />
      )}
    </div>
  );
}
