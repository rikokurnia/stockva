import LandingHero from "../components/landing-hero";
export default function Page() {
  return (
    <LandingHero
      appId={
        process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""
      }
    />
  );
}
