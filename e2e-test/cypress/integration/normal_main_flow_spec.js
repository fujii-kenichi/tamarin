import faker from "faker";
import Dexie from "dexie";

describe("主要な処理の正常系を流すテスト", () => {
    const TEST_USERNAME = `cypress-test${faker.datatype.number(10000)}`;
    const TEST_PASSWORD = `test_@${faker.datatype.number({min:10000000, max:999999999})}`;
    const TEST_PASSWORD2 = `test_@${faker.datatype.number({min:10000000, max:999999999})}`;
    const TEST_AUTHOR = `author-${faker.datatype.number(10000)}`;
    it("サインアップ", () => {
        // index.
        cy.visit("connector/");
        cy.get("a").contains("サインアップ").click();
        // signup.
        cy.location("pathname").should("eq", "/connector/signup/");
        cy.title().should("not.be.empty");
        cy.get("a").invoke("attr", "href").should("eq", "../");
        cy.get("img").invoke("width").should("gt", 0);
        cy.get("strong").invoke("text").should("not.be.empty");
        cy.get("small").invoke("text").should("not.be.empty");
        cy.get("input[name='csrfmiddlewaretoken']").invoke("val").should("not.be.empty");
        cy.get("textarea").invoke("val").should("not.be.empty");
        cy.get("#id_username").type(TEST_USERNAME);
        cy.get("#id_password1").type(TEST_PASSWORD);
        cy.get("#id_password2").type(TEST_PASSWORD);
        cy.get("button").click();
        // signup-done.
        cy.location("pathname").should("eq", "/connector/signup-done/");
        cy.title().should("not.be.empty");
        cy.get("img").invoke("width").should("gt", 0);
        cy.get("strong").invoke("text").should("not.be.empty");
        cy.get("small").invoke("text").should("not.be.empty");
        cy.get("div.subtitle").invoke("text").should("not.be.empty");
        cy.get("a").contains("戻る").click();
        // index.
        cy.location("pathname").should("eq", "/connector/");
    });
    it("タマリンカメラ", () => {
        const database = new Dexie("tamarin-camera");
        database.version("5").stores({
            user: "dummy_id, user_id",
            photo: "++id, date_taken"
        });
        let current_user = {
            dummy_id: "current_user",
            user_id: null,
            username: "",
            encrypted_password: "",
            author_name: "",
            context_tag: "",
            scene_tag: "",
            scene_color: "",
            shutter_sound: true,
            auto_reload: true,
            encryption: true,
            selected_context: null,
        };
        database.user.put(current_user);
        // index.
        cy.visit("connector/");
        cy.get("#camera").click();
        // camera-app:headers
        cy.get("head meta[name='author']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='description']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='theme-color']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='mobile-web-app-capable']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='apple-mobile-web-app-capable']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='apple-mobile-web-app-status-bar-style']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='apple-mobile-web-app-title']").invoke("attr", "content").should("not.be.empty");
        cy.get("head link[rel='shortcut icon']").invoke("attr", "href").should("not.be.empty");
        cy.get("head link[rel='apple-touch-icon']").invoke("attr", "href").should("not.be.empty");
        cy.get("head link[rel='apple-touch-startup-image']").invoke("attr", "href").should("not.be.empty");
        cy.get("head link[rel='manifest']").invoke("attr", "href").should("not.be.empty");
        // camera-app:install-view.
        cy.get("#install_view").should("be.visible");
        cy.location("pathname").should("eq", "/camera/camera-app.html");
        cy.location("search").should("be.empty");
        cy.title().should("not.be.empty");
        cy.get("img").invoke("width").should("gt", 0);
        cy.get("strong").invoke("text").should("not.be.empty");
        cy.get("small").invoke("text").should("not.be.empty");
        cy.get("a.is-warning").should("not.be.empty");
        cy.get("a.is-warning").click();
        // camera-app:signin-view.
        cy.get("#signin_view").should("be.visible");
        cy.get("#author_name").clear();
        cy.get("#username").clear();
        cy.get("#password").clear();
        cy.get("#author_name").type(TEST_AUTHOR);
        cy.get("#username").type(TEST_USERNAME);
        cy.get("#password").type(TEST_PASSWORD);
        cy.get("#signin").click();
        // camera-app:main-view.
        cy.get("#main_view").should("be.visible");
        cy.get("#setting_dialog").should("not.be.visible");
        cy.get("#current_author_name").invoke("val").should("eq", TEST_AUTHOR);
        cy.get("#context_tags").should("not.be.empty");
        cy.get("#photo_count").invoke("val").should("not.be.empty");
        cy.get("#shutters").should("not.be.empty");
        cy.get("#preview").should("be.visible");
        // camera-app:撮影1. 
        cy.get("#context_tags").select(0);
        cy.get("div.tama-shutter").eq(0).click();
        //cy.get("#photo_count").invoke("val").should("eq", "1");
        cy.wait(1000);
        cy.get("#context_tags").select(1);
        cy.get("div.tama-shutter").eq(1).click();
        //cy.get("#photo_count").invoke("val").should("eq", "2");
        cy.wait(1000);
        cy.get("#context_tags").select(2);
        cy.get("div.tama-shutter").eq(2).click();
        //cy.get("#photo_count").invoke("val").should("eq", "3");
        cy.wait(1000);
        cy.visit("connector/");
    });
    it("タマリンク", () => {
        const database = new Dexie("tamarin-link");
        database.version("5").stores({
            user: "dummy_id, user_id"
        });
        let current_user = {
            dummy_id: "current_user",
            user_id: null,
            username: "",
            encrypted_password: "",
            delete_after_download: true,
            chart: "context"
        };
        database.user.put(current_user);
        // index.
        cy.visit("connector/");
        cy.get("#link").click();
        // link-app:headers
        cy.get("head meta[name='author']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='description']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='theme-color']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='mobile-web-app-capable']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='apple-mobile-web-app-capable']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='apple-mobile-web-app-status-bar-style']").invoke("attr", "content").should("not.be.empty");
        cy.get("head meta[name='apple-mobile-web-app-title']").invoke("attr", "content").should("not.be.empty");
        cy.get("head link[rel='shortcut icon']").invoke("attr", "href").should("not.be.empty");
        cy.get("head link[rel='apple-touch-icon']").invoke("attr", "href").should("not.be.empty");
        cy.get("head link[rel='apple-touch-startup-image']").invoke("attr", "href").should("not.be.empty");
        cy.get("head link[rel='manifest']").invoke("attr", "href").should("not.be.empty");
        // link-app:install-view.
        cy.get("#install_view").should("be.visible");
        cy.location("pathname").should("eq", "/link/link-app.html");
        cy.location("search").should("be.empty");
        cy.title().should("not.be.empty");
        cy.get("img").invoke("width").should("gt", 0);
        cy.get("strong").invoke("text").should("not.be.empty");
        cy.get("small").invoke("text").should("not.be.empty");
        cy.get("a.is-warning").should("not.be.empty");
        cy.get("a.is-warning").click();
        // link-app:signin-view.
        cy.get("#signin_view").should("be.visible");
        cy.get("#username").clear();
        cy.get("#password").clear();
        cy.get("#username").type(TEST_USERNAME);
        cy.get("#password").type(TEST_PASSWORD);
        cy.get("#signin").click();
        // link-app:main-view.
        cy.get("#main_view").should("be.visible");
        cy.get("#current_username").invoke("val").should("eq", TEST_USERNAME);
        cy.get("#status_title").invoke("text").should("eq", "3");
        cy.visit("connector/");
    });
    it("パスワード変更", () => {
        // index.
        cy.visit("connector/");
        cy.get("a").contains("パスワードを変更する").click();
        // password-change
        cy.location("pathname").should("eq", "/connector/password-change/");
        cy.title().should("not.be.empty");
        cy.get("a").invoke("attr", "href").should("eq", "../");
        cy.get("img").invoke("width").should("gt", 0);
        cy.get("strong").invoke("text").should("not.be.empty");
        cy.get("small").invoke("text").should("not.be.empty");
        cy.get("input[name='csrfmiddlewaretoken']").invoke("val").should("not.be.empty");
        cy.get("#id_current_username").type(TEST_USERNAME);
        cy.get("#id_current_password").type(TEST_PASSWORD);
        cy.get("#id_new_password").type(TEST_PASSWORD2);
        cy.get("#id_confirm_new_password").type(TEST_PASSWORD2);
        cy.get("button").click();
        // password-change-done.
        cy.location("pathname").should("eq", "/connector/password-change-done/");
        cy.title().should("not.be.empty");
        cy.get("img").invoke("width").should("gt", 0);
        cy.get("strong").invoke("text").should("not.be.empty");
        cy.get("small").invoke("text").should("not.be.empty");
        cy.get("div.subtitle").invoke("text").should("not.be.empty");
        cy.get("a").contains("戻る").click();
    });
});