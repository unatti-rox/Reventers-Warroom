// Launch data for the IP Production Command Center, as supplied by the
// team (Sep 2026): brands per cohort, the IP teams, the W1-W4 rotation and
// the festival calendar. Seeded once on the first deploy; after that
// everything is edited in the app (Admin page) and never overwritten.

export const cohortSeed: { code: string; leaderName: string; brands: string[] }[] = [
  { code: "C1", leaderName: "Aasawari", brands: ["RD / RUPL", "Sajay", "Agami", "Eden", "Merx", "Sosar", "Hiranandani", "Regalia", "PCPL"] },
  { code: "C2", leaderName: "Pooja", brands: ["Raymond", "Gurukrupa", "Kensville", "Savvy", "Savvy greens", "RnY"] },
  {
    code: "C3",
    leaderName: "Shradha",
    brands: ["Fortune Primero", "Aakshya", "Viera", "IMB", "Nexsa", "Perspective", "GHP", "TRL", "Ramsons Trendsquares"],
  },
  {
    code: "C4",
    leaderName: "Shilpa",
    brands: ["Vaibhavlaxmi", "Trendsquares WOG", "Man Development", "Elements", "Vaswani", "Divyashree", "GVP", "Sibermond"],
  },
  { code: "C5", leaderName: "Harsh", brands: ["West Avenue", "Aum", "KRCH", "Patils", "Jade"] },
  { code: "C6", leaderName: "Karan Sharma", brands: ["TG", "Vascon", "MS Realty", "NCC", "Palkhi"] },
  { code: "C7", leaderName: "Yoshita", brands: ["BHC", "House of JETS", "Krisala", "Eltria", "Kumar Realty", "Ajwani Developers"] },
];

/** The four cohort groups used by the rotation, by leader name. */
const SP = ["Shradha", "Pooja"];
const HS = ["Harsh", "Shilpa"];
const AA = ["Aasawari"];
const YK = ["Yoshita", "Karan Sharma"];

export const ipSeed: {
  name: string;
  ipcs: string[];
  designers: string[];
  editors: string[];
  weeklyTarget: number;
  /** Cohort leaders assigned in W1, W2, W3, W4. */
  rotation: [string[], string[], string[], string[]];
}[] = [
  { name: "Construction Update", ipcs: ["Rahul", "Sahil"], designers: ["Avantika"], editors: ["Ashish", "Shubham", "Abhijit Sathe"], weeklyTarget: 4, rotation: [SP, HS, AA, YK] },
  { name: "Location Highlight | Restaurant", ipcs: ["Rahul", "Sahil"], designers: ["Avantika"], editors: ["Ashish", "Shubham", "Abhijit Sathe"], weeklyTarget: 5, rotation: [SP, HS, AA, YK] },
  { name: "Trending Fun Facts", ipcs: ["Rahul", "Sahil"], designers: ["Avantika"], editors: ["Ashish", "Shubham", "Abhijit Sathe"], weeklyTarget: 5, rotation: [SP, HS, AA, YK] },
  { name: "Photoshoot Model", ipcs: ["Rishika", "Muskaan"], designers: ["Nikhil"], editors: ["Abhijeet Pote"], weeklyTarget: 4, rotation: [HS, AA, YK, SP] },
  { name: "AI Walkthrough | Explainer", ipcs: ["Rishika", "Muskaan"], designers: ["Avantika"], editors: ["Abhijeet Pote"], weeklyTarget: 5, rotation: [HS, AA, YK, SP] },
  // Bytes and Team Culture share one weekly target of 6 in the rotation sheet; split 3 + 3.
  { name: "Bytes", ipcs: ["Prutha"], designers: [], editors: ["Talib", "Karan Singh"], weeklyTarget: 3, rotation: [AA, YK, SP, HS] },
  { name: "Team Culture", ipcs: ["Prutha"], designers: [], editors: ["Talib", "Karan Singh"], weeklyTarget: 3, rotation: [AA, YK, SP, HS] },
  { name: "Connectivity & Infrastructure", ipcs: ["Adarsh"], designers: ["Bhavna"], editors: ["Sameer"], weeklyTarget: 6, rotation: [YK, SP, HS, AA] },
  { name: "History Decoded | Location and Brand", ipcs: ["Akash", "Satish"], designers: ["Dhanesh", "Dallas"], editors: ["Ashish", "Sanket"], weeklyTarget: 4, rotation: [SP, HS, AA, YK] },
  { name: "Event", ipcs: ["Akash", "Satish"], designers: ["Dhanesh", "Dallas"], editors: ["Ashish", "Sanket"], weeklyTarget: 5, rotation: [SP, HS, AA, YK] },
  { name: "The Unique Thing | Elements Basement", ipcs: ["Joan"], designers: ["Apeksha"], editors: ["Omkar"], weeklyTarget: 4, rotation: [AA, YK, SP, HS] },
];

/** Editors for Festive and Non-IP work. */
export const floaterSeed = ["Adnan", "Pranit", "Shreyas", "Owaish"];

export const adminSeed = ["Ishika", "Unnati"];

/** IP monthly base target (sum of weekly targets x 4) and the rise per brand added after launch. */
export const BASE_MONTHLY_TARGET = 0;
export const PER_BRAND_INCREMENT = 0;

/** [month, date label, festival] from the team's festival sheet. */
export const festivalSeed: [number, string, string][] = [
  [1, "1 Jan", "New Year's Day"], [1, "12 Jan", "Swami Vivekananda Jayanti / National Youth Day"], [1, "13 Jan", "Lohri"],
  [1, "14 Jan", "Makar Sankranti"], [1, "14 Jan", "Pongal"], [1, "14 Jan", "Magh Bihu"],
  [1, "23 Jan", "Vasant Panchami / Saraswati Puja"], [1, "23 Jan", "Subhas Chandra Bose Jayanti"], [1, "26 Jan", "Republic Day"],
  [2, "1 Feb", "Guru Ravidas Jayanti"], [2, "14 Feb", "Valentine's Day"], [2, "15 Feb", "Maha Shivaratri"],
  [2, "19 Feb", "Chhatrapati Shivaji Maharaj Jayanti"],
  [3, "3 Mar", "Holika Dahan / Chhoti Holi"], [3, "4 Mar", "Holi"], [3, "8 Mar", "International Women's Day"],
  [3, "19 Mar", "Gudi Padwa"], [3, "19 Mar", "Ugadi"], [3, "19 Mar", "Chaitra Navratri Begins"],
  [3, "20 Mar", "Cheti Chand / Jhulelal Jayanti"], [3, "20–21 Mar*", "Eid-ul-Fitr"], [3, "23 Mar", "Shaheed Diwas"],
  [3, "26 Mar", "Ram Navami"], [3, "31 Mar", "Mahavir Jayanti"],
  [4, "2 Apr", "Hanuman Jayanti"], [4, "3 Apr", "Good Friday"], [4, "5 Apr", "Easter Sunday"],
  [4, "14 Apr", "Dr. B. R. Ambedkar Jayanti"], [4, "14 Apr", "Baisakhi / Vaisakhi"], [4, "14 Apr", "Puthandu / Tamil New Year"],
  [4, "14 Apr", "Vishu"], [4, "15 Apr", "Bohag Bihu"], [4, "15 Apr", "Poila Boishakh / Bengali New Year"],
  [4, "19 Apr", "Akshaya Tritiya"],
  [5, "1 May", "Buddha Purnima"], [5, "1 May", "Maharashtra Day"], [5, "1 May", "International Workers' Day"],
  [5, "10 May", "Mother's Day"], [5, "25 May", "Ganga Dussehra"], [5, "27 May*", "Eid-ul-Adha / Bakrid"],
  [6, "17 Jun*", "Islamic New Year / Al-Hijra"], [6, "21 Jun", "Father's Day"], [6, "21 Jun", "International Yoga Day"],
  [6, "26 Jun*", "Muharram / Ashura"], [6, "29 Jun", "Kabir Jayanti"],
  [7, "16 Jul", "Jagannath Rath Yatra"], [7, "29 Jul", "Guru Purnima"],
  [8, "2 Aug", "Friendship Day"], [8, "15 Aug", "Independence Day"], [8, "15 Aug", "Hariyali Teej"],
  [8, "17 Aug", "Nag Panchami"], [8, "26 Aug", "Onam"], [8, "26 Aug*", "Eid-e-Milad / Milad-un-Nabi"],
  [8, "28 Aug", "Raksha Bandhan"], [8, "28 Aug", "Varalakshmi Vrat"], [8, "31 Aug", "Kajari Teej"],
  [9, "4 Sep", "Krishna Janmashtami"], [9, "5 Sep", "Teachers' Day"], [9, "14 Sep", "Hartalika Teej"],
  [9, "14 Sep", "Ganesh Chaturthi"], [9, "15 Sep", "Rishi Panchami"], [9, "17 Sep", "Vishwakarma Puja"],
  [9, "19 Sep", "Radha Ashtami"], [9, "25 Sep", "Anant Chaturdashi"], [9, "25 Sep", "Ganesh Visarjan"],
  [9, "27 Sep", "Pitru Paksha Begins"],
  [10, "2 Oct", "Gandhi Jayanti"], [10, "10 Oct", "Mahalaya / Sarva Pitru Amavasya"],
  [10, "11 Oct", "Sharad Navratri Begins / Ghatasthapana"], [10, "17 Oct", "Durga Puja Festivities Begin"],
  [10, "19 Oct", "Durga Ashtami"], [10, "19 Oct", "Maha Navami"], [10, "20 Oct", "Dussehra / Vijayadashami"],
  [10, "26 Oct", "Valmiki Jayanti"], [10, "29 Oct", "Karwa Chauth"],
  [11, "1 Nov", "Ahoi Ashtami"], [11, "6 Nov", "Dhanteras"], [11, "7 Nov", "Kali Chaudas"],
  [11, "8 Nov", "Naraka Chaturdashi / Chhoti Diwali"], [11, "8 Nov", "Diwali / Lakshmi Puja"],
  [11, "9 Nov", "Govardhan Puja / Annakut"], [11, "11 Nov", "Bhai Dooj"], [11, "14 Nov", "Children's Day"],
  [11, "15 Nov", "Chhath Puja"], [11, "21 Nov", "Tulsi Vivah"], [11, "24 Nov", "Guru Nanak Jayanti / Gurpurab"],
  [11, "24 Nov", "Kartik Purnima"],
  [12, "20 Dec", "Gita Jayanti"], [12, "24 Dec", "Christmas Eve"], [12, "25 Dec", "Christmas"], [12, "31 Dec", "New Year's Eve"],
];

/**
 * One-time setup codes for the two admins (scrypt hashes only; the codes
 * themselves were handed over separately). Each admin signs in once with
 * their code and must then choose their own password.
 */
export const adminSetupCodeHashes: Record<string, string> = {
  Ishika: "scrypt$cvDebOCLXxujMMrzDuOw4g$Etyzyu2u0fXfjjE5qQXjMWZx0Ngo2eyuwkDUqYIvooGC4KkSyqIiqDFF4kxZ9BoEb_CIzqBy2n6Rz5BqQ6KPbw",
  Unnati: "scrypt$mknKo1nvPx-qRqEZdd5uPQ$FvA5S5CYaIASExLZ-QZZgpehHD3YaRzhGstcdDaKFF-3YJUtB39s0pwhSkSA1_4ianBLZfCah9eyUxPhIXYtfw",
};
