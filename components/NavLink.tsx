import Link from 'next/link';

const NavLink = ({ children, href, ...props }: any) => (
  <Link
    href={href}
    {...props}
    className={`py-2.5 px-4 text-center rounded-lg transition-colors duration-[250ms] ${
      props?.className || ''
    }`}
  >
    {children}
  </Link>
);

export default NavLink;
