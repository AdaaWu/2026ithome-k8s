Feature: 音樂與音效分開控制

  Scenario: 關掉音樂但保留音效
    Given 玩家第一次打開遊戲
    When 玩家關掉音樂
    Then 音樂是關閉的
    And 音效是開啟的

  Scenario: 開關設定重新整理後還在
    Given 玩家關掉音效
    When 玩家重新整理頁面
    Then 音效是關閉的
    And 音樂是開啟的

  Scenario: 換頁時切換曲子
    Given 玩家在起始畫面按下登島出發
    When 玩家進入角色圖鑑
    Then 正在播放的曲子是 "codex"
