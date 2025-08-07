import { db } from "./db";
import { legalOrganizations, users } from "@shared/schema";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

// WA Family Law Firms (Perth-based)
const familyLawFirms = [
  "Hickman Family Law",
  "Ryan & Bosscher Lawyers",
  "Doran Lawyers",
  "Williams Family Lawyers",
  "Mills Oakley",
  "Tottle Partners",
  "Maurice Blackburn",
  "Coulter Roache Lawyers",
  "Alder Legal",
  "Gillis Delaney Lawyers",
  "Cocks Macnish",
  "Culshaw Miller Lawyers",
  "Bateman Battersby Lawyers",
  "HHG Legal Group",
  "Pullan Kammermann",
  "Lynn Legal",
  "Corrs Chambers Westgarth",
  "Clayton Utz",
  "Herbert Smith Freehills",
  "King & Wood Mallesons",
  "Ashurst",
  "MinterEllison",
  "Norton Rose Fulbright",
  "DLA Piper",
  "Squire Patton Boggs",
  "McCullough Robertson",
  "Jackson McDonald",
  "HWL Ebsworth",
  "Lavan Legal",
  "Steinepreis Paganin"
];

const defaultOrganizations = [
  "Self Represented",
  "Not Applicable"
];

export async function seedLegalOrganizations() {
  console.log("Seeding legal organizations...");

  // Insert default organizations first
  for (const orgName of defaultOrganizations) {
    try {
      await db.insert(legalOrganizations).values({
        name: orgName,
        location: "N/A",
        isBuiltIn: true,
      }).onConflictDoNothing();
    } catch (error) {
      console.log(`Organization ${orgName} already exists`);
    }
  }

  // Insert family law firms
  for (const firmName of familyLawFirms) {
    try {
      await db.insert(legalOrganizations).values({
        name: firmName,
        location: "Perth, WA",
        isBuiltIn: true,
      }).onConflictDoNothing();
    } catch (error) {
      console.log(`Firm ${firmName} already exists`);
    }
  }

  console.log("Legal organizations seeded successfully");
}

export async function seedSampleUsers() {
  console.log("Seeding sample users...");

  const organizations = await db.select().from(legalOrganizations);
  const hashedPassword = await bcrypt.hash("password", 10);

  const sampleUsers = [
    // Key test users
    { firstName: "Ben", lastName: "Greenway", email: "bengreenway@gmail.com", orgName: "Not Applicable" },
    // Users with legal organizations
    { firstName: "Sarah", lastName: "Mitchell", email: "sarah.mitchell@hickmanlaw.com.au", orgName: "Hickman Family Law" },
    { firstName: "David", lastName: "Smith", email: "david@gmail.com", orgName: "Hickman Family Lawyers" },
    { firstName: "David", lastName: "Chen", email: "david.chen@ryanbosscher.com.au", orgName: "Ryan & Bosscher Lawyers" },
    { firstName: "Emma", lastName: "Thompson", email: "emma.thompson@doranlaw.com.au", orgName: "Doran Lawyers" },
    { firstName: "Michael", lastName: "Roberts", email: "michael.roberts@williamsfamily.com.au", orgName: "Williams Family Lawyers" },
    { firstName: "Lisa", lastName: "Wong", email: "lisa.wong@millsoakley.com.au", orgName: "Mills Oakley" },
    { firstName: "James", lastName: "Anderson", email: "james.anderson@tottle.com.au", orgName: "Tottle Partners" },
    { firstName: "Rachel", lastName: "Taylor", email: "rachel.taylor@mauriceblackburn.com.au", orgName: "Maurice Blackburn" },
    { firstName: "Thomas", lastName: "Wilson", email: "thomas.wilson@coulterroache.com.au", orgName: "Coulter Roache Lawyers" },
    { firstName: "Jennifer", lastName: "Davis", email: "jennifer.davis@alderlegal.com.au", orgName: "Alder Legal" },
    { firstName: "Robert", lastName: "Brown", email: "robert.brown@gillisdelaney.com.au", orgName: "Gillis Delaney Lawyers" },

    // Self-represented users
    { firstName: "Mark", lastName: "Johnson", email: "mark.johnson@gmail.com", orgName: "Self Represented" },
    { firstName: "Amanda", lastName: "White", email: "amanda.white@yahoo.com", orgName: "Self Represented" },
    { firstName: "Kevin", lastName: "Lee", email: "kevin.lee@outlook.com", orgName: "Self Represented" },
    { firstName: "Nicole", lastName: "Martin", email: "nicole.martin@gmail.com", orgName: "Self Represented" },
    { firstName: "Steven", lastName: "Garcia", email: "steven.garcia@hotmail.com", orgName: "Self Represented" },

    // Users with no organization specified
    { firstName: "Anna", lastName: "Rodriguez", email: "anna.rodriguez@gmail.com", orgName: "Not Applicable" },
    { firstName: "Ev", lastName: "Johnson", email: "ev@gmail.com", orgName: "Not Applicable" },
    { firstName: "Paul", lastName: "Thompson", email: "paul.thompson@outlook.com", orgName: "Not Applicable" },
    { firstName: "Michelle", lastName: "Clark", email: "michelle.clark@yahoo.com", orgName: "Not Applicable" },
    { firstName: "Daniel", lastName: "Lewis", email: "daniel.lewis@gmail.com", orgName: "Not Applicable" },
    { firstName: "Laura", lastName: "Walker", email: "laura.walker@hotmail.com", orgName: "Not Applicable" },

    // Additional users
    { firstName: "Christopher", lastName: "Hall", email: "christopher.hall@gmail.com", orgName: "Not Applicable" },
    { firstName: "Jessica", lastName: "Allen", email: "jessica.allen@outlook.com", orgName: "Not Applicable" },
    { firstName: "Matthew", lastName: "Young", email: "matthew.young@yahoo.com", orgName: "Not Applicable" },
    { firstName: "Ashley", lastName: "King", email: "ashley.king@gmail.com", orgName: "Not Applicable" },
    { firstName: "Ryan", lastName: "Wright", email: "ryan.wright@hotmail.com", orgName: "Not Applicable" },
    { firstName: "Stephanie", lastName: "Lopez", email: "stephanie.lopez@gmail.com", orgName: "Not Applicable" },
    { firstName: "Joshua", lastName: "Hill", email: "joshua.hill@outlook.com", orgName: "Not Applicable" },
    { firstName: "Melissa", lastName: "Scott", email: "melissa.scott@yahoo.com", orgName: "Not Applicable" },
    { firstName: "Andrew", lastName: "Green", email: "andrew.green@gmail.com", orgName: "Not Applicable" },
    { firstName: "Heather", lastName: "Adams", email: "heather.adams@hotmail.com", orgName: "Not Applicable" },
  ];

  for (const userData of sampleUsers) {
    try {
      const organization = organizations.find(org => org.name === userData.orgName);
      
      await db.insert(users).values({
        id: randomUUID(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: hashedPassword,
        legalOrganizationId: organization?.id || null,
        authProvider: "local",
      }).onConflictDoNothing();
      console.log(`Created user: ${userData.email}`);
    } catch (error) {
      console.log(`User ${userData.email} already exists`);
    }
  }

  console.log("Sample users seeded successfully");
}

export async function runSeed() {
  try {
    await seedLegalOrganizations();
    await seedSampleUsers();
    console.log("All seed data inserted successfully");
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}

// Run seeding if this file is executed directly
import.meta.url === `file://${process.argv[1]}` && runSeed().then(() => process.exit(0)).catch(console.error);