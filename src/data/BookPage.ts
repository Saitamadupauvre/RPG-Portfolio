/** Free-form book pages. The section decides where (and in which mode) a page is shown. */
export interface BookPage {
    id: string;
    section: 'about' | 'tutorial' | 'bestiary';
    title: string;
    body: string;
}
