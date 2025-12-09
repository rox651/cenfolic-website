import { fetchJSON } from "./http";

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

const DEFAULT_CATEGORY = "blog"

export async function getCategorySlugById(id: number): Promise<string> {
  const category = await fetchJSON<WPCategory>(
    `/categories/${id}`,
  );

  return category.slug

}

export async function getAllCategories(): Promise<WPCategory[]> {
  const categories = await fetchJSON<WPCategory[]>(
    "/categories",
  );

  return categories

}

function transformDate(date: string): string {
  const newDate = new Date(date)

  const long = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(newDate);

  return long
}

function getISODate(date: string): string {
  return date.split("T")[0];
}


async function adaptPosts(posts: WPPost[]): Promise<WPPostWithCategory[]> {

  const adaptedPosts = await Promise.all(
    posts.map(async (post) => {
      const firstCategoryId = post.categories[0];
      const categorySlug = (await getCategorySlugById(firstCategoryId)) ?? DEFAULT_CATEGORY;
      const dateISO = getISODate(post.date)
      const dateText = transformDate(post.date)


      return {
        ...post,
        dateText,
        dateISO,
        categorySlug
      } as WPPostWithCategory
    })
  );

  return adaptedPosts;

}

export async function getPosts(limit: number = 3): Promise<WPPostWithCategory[]> {
  const posts = await fetchJSON<WPPost[]>(
    `/posts?filter[posts_per_page]=${limit}&orderby=date&order=desc`
  );

  return await adaptPosts(posts)

}

export async function getAllPosts(): Promise<WPPostWithCategory[]> {
  const posts = await fetchJSON<WPPost[]>(
    "/posts?_embed",
  );

  return await adaptPosts(posts)
}


