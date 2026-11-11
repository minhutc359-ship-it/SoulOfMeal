"""Smoke test against a disposable PostgreSQL-backed Soul of Meal instance."""

import http.cookiejar
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, build_opener, Request
from uuid import uuid4


def client():
    return build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(browser, path, method="GET", data=None, token=None, extra=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Soul-CSRF"] = token
    headers.update(extra or {})
    body = json.dumps(data).encode() if data is not None else None
    try:
        response = browser.open(Request(base + "/api/v1" + path, body, headers, method=method), timeout=10)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None


def expect(status, result):
    assert result[0] == status, result
    return result[1]


def csrf(browser):
    return expect(200, request(browser, "/auth/csrf"))["token"]


def authenticate(browser, action, credentials, status):
    expect(status, request(browser, f"/auth/{action}", "POST", credentials, csrf(browser)))


def save(browser, token, account, revision, snapshot):
    return request(browser, "/me/practice-save", "PUT", {
        "accountId": account, "expectedRevision": revision, "snapshot": snapshot,
    }, token)


def snapshot(gold):
    return {
        "version": 2,
        "player": {"gold": gold, "name": "Người Kết Vị"},
        "adventure": {"quest": "accepted"},
        "roster": [],
        "modes": {"tcg": None, "chess": None},
        "settings": {"music": 40},
    }


def verify():
    first, second, stranger, wrong = (client() for _ in range(4))
    credentials = {"username": "qa_" + uuid4().hex[:16], "password": uuid4().hex}
    outsider = {"username": "qa_" + uuid4().hex[:16], "password": uuid4().hex}
    expect(401, request(first, "/me/bootstrap"))
    expect(403, request(first, "/auth/register", "POST", credentials))
    authenticate(first, "register", credentials, 201)
    assert expect(401, request(wrong, "/auth/login", "POST", {
        **credentials, "password": "the_wrong_password",
    }, csrf(wrong)))["code"] == "invalid_login"
    authenticate(second, "login", {**credentials, "username": credentials["username"].upper()}, 204)
    assert expect(409, request(wrong, "/auth/register", "POST", credentials, csrf(wrong)))["code"] == "username_taken"
    authenticate(stranger, "register", outsider, 201)
    bootstrap = expect(200, request(first, "/me/bootstrap"))
    account = bootstrap["account"]["id"]
    assert bootstrap["practiceSave"] == {"revision": 0, "snapshot": None}
    stranger_bootstrap = expect(200, request(stranger, "/me/bootstrap"))
    stranger_id = stranger_bootstrap["account"]["id"]

    first_token, second_token, stranger_token = (csrf(browser) for browser in (first, second, stranger))
    expect(403, save(first, None, account, 0, snapshot(10)))
    expect(403, save(first, stranger_token, account, 0, snapshot(10)))
    expect(401, save(stranger, stranger_token, account, 0, snapshot(10000)))
    expect(401, request(stranger, "/auth/logout", "POST", token=stranger_token,
                        extra={"X-Soul-Account": account}))
    invalid = {**snapshot(10), "player": {"name": "<script>"}}
    expect(400, save(first, first_token, account, 0, invalid))
    assert expect(200, save(first, first_token, account, 0, snapshot(200))) == {"revision": 1}
    assert expect(200, save(first, first_token, account, 0, snapshot(200))) == {"revision": 1}
    assert expect(200, request(second, "/me/bootstrap"))["practiceSave"]["snapshot"] == snapshot(200)

    with ThreadPoolExecutor(max_workers=2) as pool:
        writes = [
            pool.submit(save, first, first_token, account, 1, snapshot(201)),
            pool.submit(save, second, second_token, account, 1, snapshot(202)),
        ]
        assert sorted(write.result()[0] for write in writes) == [200, 409]
    winner = expect(200, request(first, "/me/bootstrap"))["practiceSave"]
    assert winner["revision"] == 2 and winner["snapshot"]["player"]["gold"] in (201, 202)
    assert expect(200, request(stranger, "/me/bootstrap"))["practiceSave"] == {"revision": 0, "snapshot": None}

    old_cookie = next(cookie.value for handler in first.handlers if isinstance(handler, HTTPCookieProcessor)
                      for cookie in handler.cookiejar if cookie.name == "som_session")
    expect(204, request(first, "/auth/logout", "POST", token=first_token, extra={"X-Soul-Account": account}))
    expect(401, request(first, "/me/bootstrap"))
    expect(401, request(client(), "/me/bootstrap", extra={"Cookie": "som_session=" + old_cookie}))
    assert expect(200, request(second, "/me/bootstrap"))["practiceSave"] == winner
    assert expect(200, request(stranger, "/me/bootstrap"))["account"]["id"] == stranger_id
    print("Account smoke passed: CSRF, register, login, two sessions, private save, CAS, retry, logout revocation.")


if __name__ == "__main__":
    base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5080").rstrip("/")
    verify()
