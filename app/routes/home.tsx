import type { Route } from "./+types/home";
import { LandingHeader } from "~/components/landing/landing-header";
import { DevUI } from "~/components/dev-ui";
import { LandingHero } from "~/components/landing/landing-hero";
import { LandingStats } from "~/components/landing/landing-stats";
import { LandingHowItWorks } from "~/components/landing/landing-how-it-works";
import { LandingFeaturedCourses } from "~/components/landing/landing-featured-courses";
import { LandingFooter } from "~/components/landing/landing-footer";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users } from "~/db/schema";
import { landingPage } from "~/modules/landing-page/index.server";

function getAllUsers() {
  return db.select().from(users).all();
}

function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function meta() {
  return [
    { title: "Cadence — Learn at your own pace" },
    {
      name: "description",
      content:
        "A modern course platform for developers. Browse courses, track your progress, and learn at your own pace.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { featuredCourses, stats } = landingPage.load();
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  return {
    featuredCourses,
    stats,
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      : null,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    featuredCourses,
    stats,
    users,
    currentUser,
    devCountry,
    countryTierInfo,
    countries,
  } = loaderData;
  const signedIn = currentUser !== null;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader signedIn={signedIn} />
      <LandingHero signedIn={signedIn} covers={featuredCourses} />
      <LandingStats stats={stats} />
      <LandingFeaturedCourses courses={featuredCourses} />
      <LandingHowItWorks />
      <LandingFooter signedIn={signedIn} />

      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
    </div>
  );
}
