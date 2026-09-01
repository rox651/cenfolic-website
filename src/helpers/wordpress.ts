import { fetchJSONResponse } from "./http";

export interface WPPost {
  id: number;
  slug: string;
  status: string;
  type: string;
  link: string;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  title: Content;
  excerpt: Content;
  content: Content;
  guid: Content;
  author: number;
  categories: number[];
}

export interface Content {
  rendered: string;
}

export type WPPostWithCategory = WPPost & {
  categorySlug: string;
  dateISO: string;
  dateText: string;
};

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
  parent: number;
  taxonomy: string;
  link: string;
}

const DEFAULT_CATEGORY = "blog";
const PAGE_SIZE = 100;
const POST_FIELDS = [
  "id",
  "slug",
  "status",
  "type",
  "link",
  "date",
  "date_gmt",
  "modified",
  "modified_gmt",
  "title",
  "excerpt",
  "content",
  "guid",
  "author",
  "categories",
].join(",");

let categoriesPromise: Promise<WPCategory[]> | undefined;
let allPostsPromise: Promise<WPPostWithCategory[]> | undefined;

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?";
  const firstPage = await fetchJSONResponse<T[]>(
    `${path}${separator}per_page=${PAGE_SIZE}&page=1`,
  );
  const pageCount = Number(firstPage.headers.get("x-wp-totalpages") ?? "1");
  const totalPages = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1;
  const items = [...firstPage.data];

  // Sequential pagination avoids flooding shared WordPress hosting with requests.
  for (let page = 2; page <= totalPages; page++) {
    const response = await fetchJSONResponse<T[]>(
      `${path}${separator}per_page=${PAGE_SIZE}&page=${page}`,
    );
    items.push(...response.data);
  }

  return items;
}

export async function getAllCategories(): Promise<WPCategory[]> {
  if (!categoriesPromise) {
    categoriesPromise = fetchAllPages<WPCategory>(
      "/categories?hide_empty=false",
    ).catch((error) => {
      categoriesPromise = undefined;
      throw error;
    });
  }

  return categoriesPromise;
}

export async function getCategorySlugById(id: number): Promise<string> {
  const categories = await getAllCategories();
  return categories.find((category) => category.id === id)?.slug ?? DEFAULT_CATEGORY;
}

function transformDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

function getISODate(date: string): string {
  return date.split("T")[0];
}

function adaptPosts(
  posts: WPPost[],
  categories: WPCategory[],
): WPPostWithCategory[] {
  const categorySlugs = new Map(
    categories.map((category) => [category.id, category.slug]),
  );

  return posts.map((post) => ({
    ...post,
    dateText: transformDate(post.date),
    dateISO: getISODate(post.date),
    categorySlug: categorySlugs.get(post.categories[0]) ?? DEFAULT_CATEGORY,
  }));
}

export async function getPosts(limit: number = 3): Promise<WPPostWithCategory[]> {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), PAGE_SIZE);
  const [response, categories] = await Promise.all([
    fetchJSONResponse<WPPost[]>(
      `/posts?per_page=${normalizedLimit}&orderby=date&order=desc&_fields=${POST_FIELDS}`,
    ),
    getAllCategories(),
  ]);

  return adaptPosts(response.data, categories);
}

export async function getAllPosts(): Promise<WPPostWithCategory[]> {
  if (!allPostsPromise) {
    allPostsPromise = Promise.all([
      fetchAllPages<WPPost>(
        `/posts?orderby=date&order=desc&_fields=${POST_FIELDS}`,
      ),
      getAllCategories(),
    ])
      .then(([posts, categories]) => {
        console.log(
          `[WordPress] Loaded ${posts.length} posts and ${categories.length} categories`,
        );
        return adaptPosts(posts, categories);
      })
      .catch((error) => {
        allPostsPromise = undefined;
        throw error;
      });
  }

  return allPostsPromise;
}
