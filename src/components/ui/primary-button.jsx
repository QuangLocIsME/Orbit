export default function PrimaryButton({ children, className = "", ...props }) {
  const classes = ["primary-btn", className].filter(Boolean).join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}