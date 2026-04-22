import fs from 'fs';

let content = fs.readFileSync('src/components/ProgressStepper.tsx', 'utf8');

// Replace imports
content = content.replace(
  'import { Check, ClipboardEdit, FileSearch, Eye, FileSignature, Award } from "lucide-react";',
  'import { Check, ClipboardEdit, FileSearch, Eye, FileSignature, Award, Pencil } from "lucide-react";'
);

const splitIndex = content.indexOf('const StepIcon = ({ status, index');
if (splitIndex !== -1) {
    const topPart = content.slice(0, splitIndex);
    const bottomPart = `const StepIcon = ({ status, index, selected, clickable }: { status: StageStatus; index: number; selected?: boolean; clickable?: boolean }) => {
  if (status === "completed") {
    return (
      <div className="relative z-10 w-[38px] h-[38px] rounded-full bg-primary text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 duration-300">
        <Check className="w-[18px] h-[18px] stroke-[3]" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="relative z-10 w-[38px] h-[38px] rounded-full bg-white flex items-center justify-center shadow-sm ring-[5px] ring-primary/10 ring-offset-1 ring-offset-white border border-primary/40 transition-transform hover:scale-105 duration-300">
        <div className="w-[28px] h-[28px] rounded-full bg-white border-[1.5px] border-primary text-primary flex items-center justify-center shadow-sm">
          <Pencil className="w-[13px] h-[13px] stroke-[2.5] -translate-x-[0.5px] -translate-y-[0.5px]" />
        </div>
      </div>
    );
  }

  return (
    <div className={\`relative z-10 w-[38px] h-[38px] rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm border border-slate-200 transition-colors \${clickable ? "group-hover:text-slate-500 group-hover:border-slate-300" : ""}\`}>
      {index + 1}
    </div>
  );
};

export default ProgressStepper;
`;
    // We normalize to \r\n to keep consistency if windows, but node fs.writeFileSync handles strings fine.
    fs.writeFileSync('src/components/ProgressStepper.tsx', topPart + bottomPart);
}
