import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DatePicker({ value, onChange, label, maxDate }: { value: string; onChange: (date: string) => void; label: string; maxDate?: Date }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={label} className="mt-1.5 h-12 w-full justify-start text-base font-normal">
          <CalendarDays className="mr-2 h-4 w-4" />{selected && !Number.isNaN(selected.getTime()) ? format(selected, "d MMMM yyyy") : "Choose a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="pointer-events-auto w-auto max-w-[calc(100vw-2rem)] p-0">
        <Calendar mode="single" selected={selected} onSelect={(day) => { if (day) { onChange(format(day, "yyyy-MM-dd")); setOpen(false); } }}
          defaultMonth={selected ?? maxDate ?? new Date()} captionLayout="dropdown" startMonth={new Date(2000, 0)} endMonth={maxDate ?? new Date(new Date().getFullYear() + 1, 11)}
          disabled={maxDate ? { after: maxDate } : undefined} className="pointer-events-auto p-3" />
      </PopoverContent>
    </Popover>
  );
}