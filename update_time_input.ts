import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add viewport meta tag update script to index.html
let htmlContent = fs.readFileSync('index.html', 'utf-8');
htmlContent = htmlContent.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />'
);
fs.writeFileSync('index.html', htmlContent);

// 2. Add TimeInput component to App.tsx
const timeInputComponent = `
// --- TimeInput Component ---
const TimeInput = ({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  required 
}: { 
  value: number | ''; 
  onChange: (val: number | '') => void; 
  placeholder?: string; 
  className?: string; 
  required?: boolean;
}) => {
  const formatTime = (secs: number | '') => {
    if (secs === '') return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return \`\${m}:\${s.toString().padStart(2, '0')}\`;
  };

  const parseTime = (str: string) => {
    if (!str || str.trim() === '') return '';
    if (str.includes(':')) {
      const [m, s] = str.split(':');
      return (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
    }
    return parseInt(str) || 0;
  };

  const [localVal, setLocalVal] = useState(formatTime(value));

  useEffect(() => {
    setLocalVal(formatTime(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseTime(localVal);
    onChange(parsed);
    setLocalVal(formatTime(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
  };

  return (
    <input 
      type="text" 
      inputMode="numeric"
      value={localVal} 
      onChange={handleChange} 
      onBlur={handleBlur} 
      placeholder={placeholder || "0:00"} 
      className={className} 
      required={required} 
    />
  );
};
// ---------------------------
`;

content = content.replace(
  "const App = () => {",
  timeInputComponent + "\nconst App = () => {"
);

fs.writeFileSync('src/App.tsx', content);
