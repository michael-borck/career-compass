const GradientWrapper = ({ children, ...props }: any) => (
  <div
    {...props}
    className={`relative my-16 border-t border-border sm:my-28 ${
      props.className || ''
    }`}
  >
    <div className="relative">{children}</div>
  </div>
);

export default GradientWrapper;
