import json
import math
import os
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pygame


SCREEN_WIDTH = 960
SCREEN_HEIGHT = 720
FPS = 60
TILE = 32
GRID_W = 25
GRID_H = 17
BOARD_X = 40
BOARD_Y = 112
BOARD_W = GRID_W * TILE
BOARD_H = GRID_H * TILE

TITLE = "title"
LEVEL_SELECT = "level_select"
PLAYING = "playing"
PAUSED = "paused"
SETTINGS = "settings"
GUIDE = "guide"
GAME_OVER = "game_over"
VICTORY = "victory"

BLACK = (5, 7, 14)
INK = (11, 14, 28)
PANEL = (18, 23, 44)
WALL = (32, 96, 210)
WALL_GLOW = (0, 220, 255)
WHITE = (244, 247, 255)
MUTED = (150, 168, 198)
YELLOW = (255, 222, 72)
ORANGE = (255, 148, 48)
RED = (255, 80, 90)
PINK = (255, 80, 190)
CYAN = (40, 230, 255)
GREEN = (45, 225, 128)
PURPLE = (170, 100, 255)
BLUE = (80, 145, 255)

DIRS = {
    "left": (-1, 0),
    "right": (1, 0),
    "up": (0, -1),
    "down": (0, 1),
}


def resource_path(*parts):
    base = getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)
    return Path(base).joinpath(*parts)


def clamp(value, low, high):
    return max(low, min(high, value))


def grid_to_world(cell):
    x, y = cell
    return pygame.Vector2(BOARD_X + x * TILE + TILE / 2, BOARD_Y + y * TILE + TILE / 2)


def world_to_grid(pos):
    return int((pos.x - BOARD_X) // TILE), int((pos.y - BOARD_Y) // TILE)


def draw_text(surface, font, text, color, center=None, topleft=None):
    image = font.render(text, True, color)
    rect = image.get_rect()
    if center:
        rect.center = center
    if topleft:
        rect.topleft = topleft
    surface.blit(image, rect)
    return rect


class Fonts:
    def __init__(self):
        self.hero = pygame.font.Font(None, 82)
        self.big = pygame.font.Font(None, 56)
        self.medium = pygame.font.Font(None, 38)
        self.small = pygame.font.Font(None, 28)
        self.tiny = pygame.font.Font(None, 22)
        self.cn = pygame.font.SysFont("microsoftyahei,simhei,pingfangsc,arialunicode", 26)
        self.cn_big = pygame.font.SysFont("microsoftyahei,simhei,pingfangsc,arialunicode", 40, bold=True)


class SoundManager:
    def __init__(self):
        self.volume = 60
        self.sounds = {}
        self.music_tracks = []
        self.current_music_index = 0
        self.music_loaded = False
        self.is_music_playing = False
        self.muted = False

        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init()
        except pygame.error:
            return

        self.load_sounds()
        self.load_music_tracks()
        self.load_current_music()

    def load_sounds(self):
        specs = {
            "eat": ("eat.wav", 700, 0.055),
            "win": ("win.wav", 920, 0.18),
            "hit": ("gameover.wav", 180, 0.22),
            "dash": (None, 1200, 0.06),
            "pickup": (None, 540, 0.1),
            "menu": (None, 420, 0.05),
        }
        sound_dir = resource_path("assets", "sounds")
        for name, (filename, freq, duration) in specs.items():
            path = sound_dir / filename if filename else None
            try:
                if path and path.exists():
                    sound = pygame.mixer.Sound(str(path))
                else:
                    sound = self.create_tone(freq, duration)
                if sound:
                    sound.set_volume(self.volume / 100 * 0.55)
                    self.sounds[name] = sound
            except pygame.error:
                pass

    def create_tone(self, freq, duration):
        try:
            import array

            sample_rate = 22050
            samples = array.array("h")
            total = int(sample_rate * duration)
            for i in range(total):
                env = min(1.0, i / max(1, total * 0.08), (total - i) / max(1, total * 0.12))
                wave = math.sin(2 * math.pi * freq * i / sample_rate)
                samples.append(int(wave * env * 12000))
            return pygame.mixer.Sound(buffer=samples.tobytes())
        except Exception:
            return None

    def load_music_tracks(self):
        track_specs = [
            ("玩家音乐", ["PLAYER_MUSIC.wav", "PLAYER_MUSIC.mp3"]),
            ("枫叶人音乐", ["MapleLeaf_Music.MP3", "MapleLeaf_Music.mp3", "MUSIC.MP3", "MUSIC.mp3", "MUSIC.wav"]),
        ]
        self.music_tracks = []
        for name, filenames in track_specs:
            for filename in filenames:
                path = resource_path(filename)
                if path.exists():
                    self.music_tracks.append({"name": name, "path": path})
                    break

    def load_current_music(self):
        self.music_loaded = False
        if not pygame.mixer.get_init() or not self.music_tracks:
            return
        self.current_music_index %= len(self.music_tracks)
        try:
            pygame.mixer.music.load(str(self.music_tracks[self.current_music_index]["path"]))
            pygame.mixer.music.set_volume(0 if self.muted else self.volume / 100 * 0.7)
            self.music_loaded = True
        except pygame.error:
            self.music_loaded = False

    def play(self, name):
        if self.muted:
            return
        sound = self.sounds.get(name)
        if sound:
            try:
                sound.play()
            except pygame.error:
                pass

    def play_music(self):
        if self.music_loaded and not self.is_music_playing:
            try:
                pygame.mixer.music.play(-1)
                self.is_music_playing = True
            except pygame.error:
                pass

    def stop_music(self):
        try:
            pygame.mixer.music.stop()
        except pygame.error:
            pass
        self.is_music_playing = False

    def pause_music(self):
        try:
            pygame.mixer.music.pause()
        except pygame.error:
            pass

    def unpause_music(self):
        try:
            pygame.mixer.music.unpause()
        except pygame.error:
            pass

    def switch_music(self, step=1):
        if not self.music_tracks:
            return
        was_playing = self.is_music_playing
        self.current_music_index = (self.current_music_index + step) % len(self.music_tracks)
        self.load_current_music()
        if was_playing:
            try:
                pygame.mixer.music.play(-1)
            except pygame.error:
                pass

    def current_music_name(self):
        if not self.music_tracks:
            return "No Music"
        return self.music_tracks[self.current_music_index]["name"]

    def set_volume(self, value):
        self.volume = clamp(int(value), 0, 100)
        for sound in self.sounds.values():
            sound.set_volume(self.volume / 100 * 0.55)
        if pygame.mixer.get_init():
            pygame.mixer.music.set_volume(0 if self.muted else self.volume / 100 * 0.7)

    def toggle_mute(self):
        self.muted = not self.muted
        self.set_volume(self.volume)


@dataclass
class LevelDefinition:
    name: str
    subtitle: str
    objective: str
    theme: tuple
    player_start: tuple
    ghost_spawns: list
    blocks: list
    pellets: list
    crystals: list = field(default_factory=list)
    cores: list = field(default_factory=list)
    shields: list = field(default_factory=list)
    traps: list = field(default_factory=list)
    portals: list = field(default_factory=list)
    exit_cell: tuple | None = None
    win_type: str = "dots"
    ghost_types: list = field(default_factory=lambda: ["chase", "ambush", "wander"])
    dot_quota: float = 1.0


def rect_cells(x1, y1, x2, y2):
    return [(x, y) for x in range(x1, x2 + 1) for y in range(y1, y2 + 1)]


LEVELS = [
    LevelDefinition(
        name="01  Bite Circuit",
        subtitle="Clean bites, quick turns",
        objective="Eat every light pellet. Power pellets let you bite back.",
        theme=(YELLOW, CYAN),
        player_start=(12, 13),
        ghost_spawns=[(12, 7), (11, 7), (13, 7)],
        blocks=[
            *rect_cells(3, 3, 6, 3), *rect_cells(18, 3, 21, 3),
            *rect_cells(3, 13, 6, 13), *rect_cells(18, 13, 21, 13),
            *rect_cells(5, 5, 5, 11), *rect_cells(19, 5, 19, 11),
            *rect_cells(9, 5, 15, 5), *rect_cells(9, 11, 15, 11),
            *rect_cells(11, 7, 13, 9), (12, 6), (12, 10),
        ],
        pellets=[(2, 2), (22, 2), (2, 14), (22, 14)],
        shields=[(12, 2)],
        win_type="dots",
        ghost_types=["chase", "ambush", "wander"],
    ),
    LevelDefinition(
        name="02  Crystal Gate",
        subtitle="Keys first, exit second",
        objective="Collect 3 crystals, then enter the green gate.",
        theme=(CYAN, PURPLE),
        player_start=(2, 14),
        ghost_spawns=[(12, 8), (20, 2), (21, 13), (4, 3)],
        blocks=[
            *rect_cells(4, 2, 4, 8), *rect_cells(20, 8, 20, 14),
            *rect_cells(7, 4, 17, 4), *rect_cells(7, 12, 17, 12),
            *rect_cells(8, 7, 10, 9), *rect_cells(14, 7, 16, 9),
            *rect_cells(12, 2, 12, 6), *rect_cells(12, 10, 12, 14),
        ],
        pellets=[(2, 2), (22, 14)],
        crystals=[(22, 2), (12, 8), (3, 12)],
        shields=[(7, 14)],
        portals=[((1, 8), (23, 8)), ((12, 1), (12, 15))],
        exit_cell=(22, 8),
        win_type="crystal_gate",
        ghost_types=["chase", "ambush", "sentinel", "wander"],
        dot_quota=0.65,
    ),
    LevelDefinition(
        name="03  Core Run",
        subtitle="Grab the cores and escape",
        objective="Collect 4 cores and escape. Traps punish lazy routes.",
        theme=(ORANGE, GREEN),
        player_start=(12, 15),
        ghost_spawns=[(12, 2), (3, 8), (21, 8), (12, 8)],
        blocks=[
            *rect_cells(2, 4, 8, 4), *rect_cells(16, 4, 22, 4),
            *rect_cells(2, 12, 8, 12), *rect_cells(16, 12, 22, 12),
            *rect_cells(6, 6, 6, 10), *rect_cells(18, 6, 18, 10),
            *rect_cells(10, 6, 14, 6), *rect_cells(10, 10, 14, 10),
            (12, 7), (12, 9),
        ],
        pellets=[(1, 1), (23, 1), (1, 15), (23, 15)],
        cores=[(3, 2), (21, 2), (3, 14), (21, 14)],
        shields=[(12, 8), (12, 1)],
        traps=[(8, 8), (9, 8), (15, 8), (16, 8), (12, 4), (12, 12)],
        portals=[((1, 8), (23, 8))],
        exit_cell=(12, 1),
        win_type="cores_exit",
        ghost_types=["chase", "ambush", "sentinel", "wander"],
        dot_quota=0.45,
    ),
    LevelDefinition(
        name="04  Warden Circuit",
        subtitle="A boss maze with escape rules",
        objective="Collect relics, dodge the Warden, escape through the gate.",
        theme=(PINK, BLUE),
        player_start=(12, 14),
        ghost_spawns=[(12, 7), (5, 3), (19, 3), (12, 2)],
        blocks=[
            *rect_cells(3, 3, 9, 3), *rect_cells(15, 3, 21, 3),
            *rect_cells(3, 13, 9, 13), *rect_cells(15, 13, 21, 13),
            *rect_cells(3, 5, 3, 11), *rect_cells(21, 5, 21, 11),
            *rect_cells(7, 6, 17, 6), *rect_cells(7, 10, 17, 10),
            *rect_cells(10, 7, 10, 9), *rect_cells(14, 7, 14, 9),
        ],
        pellets=[(2, 2), (22, 2), (2, 14), (22, 14)],
        crystals=[(12, 8), (5, 11), (19, 11)],
        shields=[(12, 4)],
        traps=[(6, 8), (7, 8), (17, 8), (18, 8), (12, 12)],
        portals=[((1, 8), (23, 8)), ((12, 1), (12, 15))],
        exit_cell=(12, 2),
        win_type="warden_gate",
        ghost_types=["warden", "chase", "ambush", "sentinel"],
        dot_quota=0.35,
    ),
]


class Maze:
    def __init__(self, definition):
        self.definition = definition
        self.width = GRID_W
        self.height = GRID_H
        self.walls = set()
        self.dots = {}
        self.pellets = set(definition.pellets)
        self.crystals = set(definition.crystals)
        self.cores = set(definition.cores)
        self.shields = set(definition.shields)
        self.traps = set(definition.traps)
        self.portals = list(definition.portals)
        self.exit_cell = definition.exit_cell
        self.total_dots = 0
        self.build()

    def build(self):
        for x in range(self.width):
            self.walls.add((x, 0))
            self.walls.add((x, self.height - 1))
        for y in range(self.height):
            self.walls.add((0, y))
            self.walls.add((self.width - 1, y))
        self.walls.update(self.definition.blocks)

        blocked = set(self.walls)
        blocked.update(self.definition.pellets)
        blocked.update(self.definition.crystals)
        blocked.update(self.definition.cores)
        blocked.update(self.definition.shields)
        blocked.update(self.definition.traps)
        if self.exit_cell:
            blocked.add(self.exit_cell)
        for a, b in self.portals:
            blocked.add(a)
            blocked.add(b)
        blocked.add(self.definition.player_start)
        blocked.update(self.definition.ghost_spawns)

        for y in range(1, self.height - 1):
            for x in range(1, self.width - 1):
                if (x, y) not in blocked and (x + y) % 2 == 0:
                    self.dots[(x, y)] = True
        self.total_dots = len(self.dots)

    def is_wall(self, cell):
        x, y = cell
        if x < 0 or y < 0 or x >= self.width or y >= self.height:
            return True
        return cell in self.walls

    def can_move_to(self, pos, radius=11):
        checks = [
            (pos.x - radius, pos.y - radius),
            (pos.x + radius, pos.y - radius),
            (pos.x - radius, pos.y + radius),
            (pos.x + radius, pos.y + radius),
        ]
        for px, py in checks:
            cell = (int((px - BOARD_X) // TILE), int((py - BOARD_Y) // TILE))
            if self.is_wall(cell):
                return False
        return True

    def open_neighbors(self, cell):
        result = []
        for direction in DIRS.values():
            nxt = (cell[0] + direction[0], cell[1] + direction[1])
            if not self.is_wall(nxt):
                result.append(direction)
        return result

    def dot_progress(self):
        if self.total_dots == 0:
            return 1.0
        eaten = self.total_dots - len(self.dots)
        return eaten / self.total_dots

    def portal_destination(self, cell):
        for a, b in self.portals:
            if cell == a:
                return b
            if cell == b:
                return a
        return None

    def draw(self, surface, tick, accent):
        board = pygame.Rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H)
        pygame.draw.rect(surface, (7, 10, 22), board, border_radius=12)
        pygame.draw.rect(surface, (31, 43, 78), board, 2, border_radius=12)

        pulse = 1 + 0.18 * math.sin(tick * 0.006)
        for cell in self.walls:
            x = BOARD_X + cell[0] * TILE
            y = BOARD_Y + cell[1] * TILE
            rect = pygame.Rect(x + 2, y + 2, TILE - 4, TILE - 4)
            pygame.draw.rect(surface, WALL, rect, border_radius=7)
            pygame.draw.rect(surface, WALL_GLOW, rect, 1, border_radius=7)

        for cell in self.dots:
            pos = grid_to_world(cell)
            pygame.draw.circle(surface, (245, 216, 130), pos, 3)

        for cell in self.pellets:
            pos = grid_to_world(cell)
            pygame.draw.circle(surface, WHITE, pos, int(7 * pulse))
            pygame.draw.circle(surface, accent, pos, 10, 1)

        for cell in self.crystals:
            pos = grid_to_world(cell)
            pts = [(pos.x, pos.y - 13), (pos.x + 12, pos.y), (pos.x, pos.y + 13), (pos.x - 12, pos.y)]
            pygame.draw.polygon(surface, CYAN, pts)
            pygame.draw.polygon(surface, WHITE, pts, 1)

        for cell in self.cores:
            pos = grid_to_world(cell)
            pygame.draw.circle(surface, ORANGE, pos, 12)
            pygame.draw.circle(surface, YELLOW, pos, 6)
            pygame.draw.circle(surface, WHITE, pos, 13, 1)

        for cell in self.shields:
            pos = grid_to_world(cell)
            pygame.draw.circle(surface, GREEN, pos, 11, 2)
            pygame.draw.arc(surface, GREEN, (pos.x - 10, pos.y - 10, 20, 20), 0.3, 5.9, 2)

        for cell in self.traps:
            x = BOARD_X + cell[0] * TILE
            y = BOARD_Y + cell[1] * TILE
            offset = int(4 * math.sin(tick * 0.01 + cell[0]))
            pygame.draw.polygon(surface, RED, [(x + 6, y + 25), (x + 16, y + 7 + offset), (x + 26, y + 25)])

        for a, b in self.portals:
            for cell, color in ((a, PURPLE), (b, CYAN)):
                pos = grid_to_world(cell)
                pygame.draw.circle(surface, color, pos, 13, 3)
                pygame.draw.circle(surface, WHITE, pos, 6, 1)

        if self.exit_cell:
            pos = grid_to_world(self.exit_cell)
            open_gate = self.is_exit_open()
            color = GREEN if open_gate else RED
            rect = pygame.Rect(0, 0, 24, 30)
            rect.center = pos
            pygame.draw.rect(surface, color, rect, border_radius=5)
            pygame.draw.rect(surface, WHITE, rect, 2, border_radius=5)
            if not open_gate:
                pygame.draw.line(surface, WHITE, rect.topleft, rect.bottomright, 2)
                pygame.draw.line(surface, WHITE, rect.topright, rect.bottomleft, 2)

    def is_exit_open(self):
        win = self.definition.win_type
        if win == "crystal_gate":
            return not self.crystals
        if win == "cores_exit":
            return not self.cores
        if win == "warden_gate":
            return not self.crystals and self.dot_progress() >= self.definition.dot_quota
        return True


class Player:
    def __init__(self, cell):
        self.pos = grid_to_world(cell)
        self.direction = pygame.Vector2(0, 0)
        self.queued = pygame.Vector2(0, 0)
        self.radius = 12
        self.base_speed = 165
        self.dash_timer = 0
        self.dash_cooldown = 0
        self.power_timer = 0
        self.shield = 0
        self.portal_cooldown = 0
        self.mouth = 0
        self.last_safe = self.pos.copy()

    def set_direction(self, vec):
        self.queued = pygame.Vector2(vec)

    def dash(self):
        if self.dash_cooldown <= 0 and self.direction.length_squared() > 0:
            self.dash_timer = 0.17
            self.dash_cooldown = 2.2
            return True
        return False

    def update(self, dt, maze):
        if self.power_timer > 0:
            self.power_timer -= dt
        if self.dash_timer > 0:
            self.dash_timer -= dt
        if self.dash_cooldown > 0:
            self.dash_cooldown -= dt
        if self.portal_cooldown > 0:
            self.portal_cooldown -= dt

        speed = self.base_speed * (3.0 if self.dash_timer > 0 else 1.0)
        center_cell = world_to_grid(self.pos)
        cell_center = grid_to_world(center_cell)
        near_center = self.pos.distance_to(cell_center) < 6

        if self.queued.length_squared() and near_center:
            test = self.pos + self.queued * 9
            if maze.can_move_to(test, self.radius):
                self.direction = self.queued.copy()
                self.pos = cell_center

        nxt = self.pos + self.direction * speed * dt
        if maze.can_move_to(nxt, self.radius):
            self.pos = nxt
            self.last_safe = self.pos.copy()
        else:
            self.pos = cell_center
            self.direction.update(0, 0)

        self.mouth = (self.mouth + dt * 10) % (math.pi * 2)

    def draw(self, surface):
        color = WHITE if self.dash_timer > 0 and int(pygame.time.get_ticks() / 70) % 2 else YELLOW
        angle = abs(math.sin(self.mouth)) * 0.55 + 0.12
        direction_angle = 0
        if self.direction.x < 0:
            direction_angle = math.pi
        elif self.direction.y < 0:
            direction_angle = -math.pi / 2
        elif self.direction.y > 0:
            direction_angle = math.pi / 2

        pygame.draw.circle(surface, color, self.pos, self.radius)
        p1 = self.pos
        p2 = self.pos + pygame.Vector2(math.cos(direction_angle - angle), math.sin(direction_angle - angle)) * 18
        p3 = self.pos + pygame.Vector2(math.cos(direction_angle + angle), math.sin(direction_angle + angle)) * 18
        pygame.draw.polygon(surface, BLACK, [p1, p2, p3])
        if self.shield:
            pygame.draw.circle(surface, GREEN, self.pos, self.radius + 7, 2)
        if self.power_timer > 0:
            pygame.draw.circle(surface, CYAN, self.pos, self.radius + 11, 1)


class Ghost:
    COLORS = {
        "chase": RED,
        "ambush": PINK,
        "wander": ORANGE,
        "sentinel": PURPLE,
        "warden": BLUE,
    }

    def __init__(self, cell, ghost_type):
        self.spawn_cell = cell
        self.pos = grid_to_world(cell)
        self.type = ghost_type
        self.color = self.COLORS.get(ghost_type, RED)
        self.direction = pygame.Vector2(random.choice(list(DIRS.values())))
        self.radius = 15 if ghost_type == "warden" else 12
        self.speed = 118 if ghost_type != "warden" else 96
        self.decide_timer = 0
        self.respawn_timer = 0

    def reset(self):
        self.pos = grid_to_world(self.spawn_cell)
        self.direction = pygame.Vector2(random.choice(list(DIRS.values())))
        self.respawn_timer = 1.2

    def target_for(self, player):
        player_cell = world_to_grid(player.pos)
        if self.type == "ambush" and player.direction.length_squared():
            return (player_cell[0] + int(player.direction.x * 4), player_cell[1] + int(player.direction.y * 4))
        if self.type == "wander":
            return random.choice([(1, 1), (23, 1), (1, 15), (23, 15)])
        if self.type == "sentinel":
            return (12, 8)
        return player_cell

    def update(self, dt, maze, player, global_speed=1.0):
        if self.respawn_timer > 0:
            self.respawn_timer -= dt
            return

        self.decide_timer -= dt
        cell = world_to_grid(self.pos)
        center = grid_to_world(cell)
        near_center = self.pos.distance_to(center) < 5
        if near_center and self.decide_timer <= 0:
            options = [pygame.Vector2(v) for v in maze.open_neighbors(cell)]
            reverse = -self.direction
            if len(options) > 1:
                options = [v for v in options if v != reverse]
            target = self.target_for(player)
            if player.power_timer > 0:
                target = (cell[0] * 2 - target[0], cell[1] * 2 - target[1])

            def score(vec):
                nxt = (cell[0] + int(vec.x), cell[1] + int(vec.y))
                dist = abs(nxt[0] - target[0]) + abs(nxt[1] - target[1])
                jitter = random.random() * (4 if self.type == "wander" else 1)
                return dist + jitter

            if options:
                self.direction = min(options, key=score)
                self.pos = center
            self.decide_timer = 0.12 if self.type != "warden" else 0.2

        speed = self.speed * global_speed
        if player.power_timer > 0:
            speed *= 0.74
        nxt = self.pos + self.direction * speed * dt
        if maze.can_move_to(nxt, self.radius):
            self.pos = nxt
        else:
            self.direction *= -1

    def draw(self, surface, frightened=False):
        color = BLUE if frightened else self.color
        if frightened and int(pygame.time.get_ticks() / 130) % 2:
            color = WHITE
        pygame.draw.circle(surface, color, (int(self.pos.x), int(self.pos.y - 5)), self.radius)
        body = pygame.Rect(0, 0, self.radius * 2, self.radius + 12)
        body.center = (self.pos.x, self.pos.y + 4)
        pygame.draw.rect(surface, color, body, border_radius=7)
        for dx in (-5, 5):
            pygame.draw.circle(surface, WHITE, (int(self.pos.x + dx), int(self.pos.y - 5)), 4)
            pygame.draw.circle(surface, BLACK, (int(self.pos.x + dx), int(self.pos.y - 5)), 2)
        if self.type == "warden":
            pygame.draw.circle(surface, WHITE, self.pos, self.radius + 3, 2)


class Particle:
    def __init__(self, pos, color, text=None):
        self.pos = pygame.Vector2(pos)
        self.vel = pygame.Vector2(random.uniform(-25, 25), random.uniform(-70, -25))
        self.color = color
        self.life = 0.8
        self.text = text

    def update(self, dt):
        self.life -= dt
        self.pos += self.vel * dt

    def draw(self, surface, font):
        if self.life <= 0:
            return
        alpha = clamp(int(255 * self.life / 0.8), 0, 255)
        if self.text:
            img = font.render(self.text, True, self.color)
            img.set_alpha(alpha)
            surface.blit(img, img.get_rect(center=self.pos))
        else:
            pygame.draw.circle(surface, self.color, self.pos, max(1, int(5 * self.life)))


class Game:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Chomp / 大口吃")
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        self.clock = pygame.time.Clock()
        self.fonts = Fonts()
        self.sound = SoundManager()
        self.state = TITLE
        self.previous_state = TITLE
        self.selected_level = 0
        self.maze = None
        self.player = None
        self.ghosts = []
        self.score = 0
        self.combo = 0
        self.lives = 3
        self.particles = []
        self.status = ""
        self.status_timer = 0
        self.global_timer = 0
        self.high_score = self.load_high_score()
        self.sound.play_music()

    def load_high_score(self):
        path = Path(__file__).resolve().parent / "highscore.json"
        try:
            if path.exists():
                return int(json.loads(path.read_text(encoding="utf-8")).get("high_score", 0))
        except Exception:
            pass
        return 0

    def save_high_score(self):
        if self.score <= self.high_score:
            return
        self.high_score = self.score
        path = Path(__file__).resolve().parent / "highscore.json"
        try:
            path.write_text(json.dumps({"high_score": self.high_score}, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass

    def start_level(self, index, reset_score=False):
        if reset_score:
            self.score = 0
            self.lives = 3
        self.selected_level = index % len(LEVELS)
        definition = LEVELS[self.selected_level]
        self.maze = Maze(definition)
        self.player = Player(definition.player_start)
        self.ghosts = []
        for i, spawn in enumerate(definition.ghost_spawns):
            ghost_type = definition.ghost_types[i % len(definition.ghost_types)]
            self.ghosts.append(Ghost(spawn, ghost_type))
        self.combo = 0
        self.global_timer = 0
        self.status = definition.objective
        self.status_timer = 4
        self.state = PLAYING
        self.sound.play("menu")
        self.sound.play_music()

    def lose_life(self):
        if self.player.shield:
            self.player.shield = 0
            self.player.dash_timer = 0.35
            self.add_pop(self.player.pos, "SHIELD", GREEN)
            self.sound.play("pickup")
            return
        self.lives -= 1
        self.combo = 0
        self.sound.play("hit")
        if self.lives <= 0:
            self.save_high_score()
            self.state = GAME_OVER
            self.sound.stop_music()
            return
        self.player.pos = grid_to_world(LEVELS[self.selected_level].player_start)
        self.player.direction.update(0, 0)
        self.player.queued.update(0, 0)
        self.player.dash_timer = 0.8
        for ghost in self.ghosts:
            ghost.reset()
        self.status = f"Life lost. {self.lives} lives remain."
        self.status_timer = 2.2

    def add_score(self, points, pos=None, label=None, color=YELLOW):
        self.score += points
        if pos and label:
            self.add_pop(pos, label, color)

    def add_pop(self, pos, text, color):
        self.particles.append(Particle(pos, color, text))

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_ESCAPE,):
                    if self.state == PLAYING:
                        self.state = PAUSED
                        self.sound.pause_music()
                    elif self.state == PAUSED:
                        self.state = PLAYING
                        self.sound.unpause_music()
                    elif self.state in (GUIDE, SETTINGS, LEVEL_SELECT):
                        self.state = TITLE
                    elif self.state == TITLE:
                        return False
                self.handle_key(event.key)
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                self.handle_click(event.pos)
        return True

    def handle_key(self, key):
        if self.state == PLAYING:
            if key in (pygame.K_LEFT, pygame.K_a):
                self.player.set_direction(DIRS["left"])
            elif key in (pygame.K_RIGHT, pygame.K_d):
                self.player.set_direction(DIRS["right"])
            elif key in (pygame.K_UP, pygame.K_w):
                self.player.set_direction(DIRS["up"])
            elif key in (pygame.K_DOWN, pygame.K_s):
                self.player.set_direction(DIRS["down"])
            elif key == pygame.K_SPACE:
                if self.player.dash():
                    self.sound.play("dash")
        elif self.state == TITLE:
            if key in (pygame.K_RETURN, pygame.K_SPACE):
                self.state = LEVEL_SELECT
        elif self.state == LEVEL_SELECT:
            if pygame.K_1 <= key <= pygame.K_4:
                self.start_level(key - pygame.K_1, reset_score=True)
        elif self.state == PAUSED:
            if key in (pygame.K_RETURN, pygame.K_SPACE):
                self.state = PLAYING
                self.sound.unpause_music()
            elif key == pygame.K_m:
                self.state = TITLE
                self.sound.stop_music()
        elif self.state == SETTINGS:
            if key in (pygame.K_LEFT, pygame.K_a):
                self.sound.set_volume(self.sound.volume - 5)
            elif key in (pygame.K_RIGHT, pygame.K_d):
                self.sound.set_volume(self.sound.volume + 5)
            elif key in (pygame.K_UP, pygame.K_DOWN, pygame.K_m):
                self.sound.switch_music()
            elif key == pygame.K_SPACE:
                self.sound.toggle_mute()
        elif self.state in (GAME_OVER, VICTORY):
            if key in (pygame.K_RETURN, pygame.K_SPACE):
                self.state = TITLE
                self.sound.play_music()

    def button(self, text, rect, accent=CYAN):
        mouse = pygame.mouse.get_pos()
        hovered = rect.collidepoint(mouse)
        fill = (26, 35, 66) if hovered else (16, 22, 42)
        pygame.draw.rect(self.screen, fill, rect, border_radius=8)
        pygame.draw.rect(self.screen, accent if hovered else (66, 86, 130), rect, 2, border_radius=8)
        draw_text(self.screen, self.fonts.cn if any(ord(c) > 127 for c in text) else self.fonts.medium, text,
                  YELLOW if hovered else WHITE, center=rect.center)
        return hovered

    def handle_click(self, pos):
        if self.state == TITLE:
            buttons = self.title_buttons()
            if buttons["play"].collidepoint(pos):
                self.state = LEVEL_SELECT
                self.sound.play("menu")
            elif buttons["guide"].collidepoint(pos):
                self.state = GUIDE
                self.sound.play("menu")
            elif buttons["settings"].collidepoint(pos):
                self.previous_state = TITLE
                self.state = SETTINGS
                self.sound.play("menu")
            elif buttons["quit"].collidepoint(pos):
                pygame.event.post(pygame.event.Event(pygame.QUIT))
        elif self.state == LEVEL_SELECT:
            for i, rect in enumerate(self.level_cards()):
                if rect.collidepoint(pos):
                    self.start_level(i, reset_score=True)
            if pygame.Rect(40, 34, 120, 42).collidepoint(pos):
                self.state = TITLE
        elif self.state == PAUSED:
            buttons = self.pause_buttons()
            if buttons["resume"].collidepoint(pos):
                self.state = PLAYING
                self.sound.unpause_music()
            elif buttons["settings"].collidepoint(pos):
                self.previous_state = PAUSED
                self.state = SETTINGS
            elif buttons["menu"].collidepoint(pos):
                self.state = TITLE
                self.sound.stop_music()
        elif self.state == SETTINGS:
            if pygame.Rect(265, 254, 55, 44).collidepoint(pos):
                self.sound.set_volume(self.sound.volume - 5)
            elif pygame.Rect(640, 254, 55, 44).collidepoint(pos):
                self.sound.set_volume(self.sound.volume + 5)
            elif pygame.Rect(258, 358, 55, 44).collidepoint(pos):
                self.sound.switch_music(-1)
            elif pygame.Rect(647, 358, 55, 44).collidepoint(pos):
                self.sound.switch_music(1)
            elif pygame.Rect(385, 454, 190, 44).collidepoint(pos):
                self.sound.toggle_mute()
            elif pygame.Rect(40, 34, 120, 42).collidepoint(pos):
                self.state = TITLE if self.previous_state == TITLE else PAUSED
        elif self.state == GUIDE:
            self.state = TITLE
        elif self.state in (GAME_OVER, VICTORY):
            self.state = TITLE
            self.sound.play_music()

    def update(self, dt):
        if self.state != PLAYING:
            for p in self.particles:
                p.update(dt)
            self.particles = [p for p in self.particles if p.life > 0]
            return

        self.global_timer += dt
        if self.status_timer > 0:
            self.status_timer -= dt

        self.player.update(dt, self.maze)
        player_cell = world_to_grid(self.player.pos)
        self.handle_collections(player_cell)
        self.handle_portals(player_cell)
        self.handle_traps(player_cell)

        speed_boost = 1 + min(0.35, self.global_timer / 260)
        if self.maze.definition.win_type == "cores_exit":
            speed_boost += min(0.25, self.global_timer / 180)
        for ghost in self.ghosts:
            ghost.update(dt, self.maze, self.player, speed_boost)
            if ghost.respawn_timer <= 0 and ghost.pos.distance_to(self.player.pos) < ghost.radius + self.player.radius - 2:
                if self.player.power_timer > 0:
                    self.combo += 1
                    pts = 200 * self.combo
                    self.add_score(pts, ghost.pos, f"+{pts}", CYAN)
                    ghost.reset()
                    self.sound.play("pickup")
                elif self.player.dash_timer <= 0:
                    self.lose_life()
                    break

        for p in self.particles:
            p.update(dt)
        self.particles = [p for p in self.particles if p.life > 0]

        self.check_win()

    def handle_collections(self, cell):
        if cell in self.maze.dots:
            del self.maze.dots[cell]
            self.combo = min(20, self.combo + 1)
            self.add_score(10 + self.combo, grid_to_world(cell), "+", YELLOW)
            self.sound.play("eat")
        if cell in self.maze.pellets:
            self.maze.pellets.remove(cell)
            self.player.power_timer = 7.0
            self.combo = 0
            self.add_score(80, grid_to_world(cell), "POWER", CYAN)
            self.sound.play("pickup")
        if cell in self.maze.crystals:
            self.maze.crystals.remove(cell)
            self.add_score(350, grid_to_world(cell), "CRYSTAL", CYAN)
            self.status = "Crystal secured. Gate is closer."
            self.status_timer = 2
            self.sound.play("pickup")
        if cell in self.maze.cores:
            self.maze.cores.remove(cell)
            self.add_score(450, grid_to_world(cell), "CORE", ORANGE)
            self.status = "Reactor core stolen. Ghost speed rising."
            self.status_timer = 2
            self.sound.play("pickup")
        if cell in self.maze.shields:
            self.maze.shields.remove(cell)
            self.player.shield = 1
            self.add_score(120, grid_to_world(cell), "SHIELD", GREEN)
            self.sound.play("pickup")

    def handle_portals(self, cell):
        if self.player.portal_cooldown > 0:
            return
        dest = self.maze.portal_destination(cell)
        if dest:
            target = grid_to_world(dest)
            if self.player.pos.distance_to(grid_to_world(cell)) < 7:
                exit_dir = self.player.direction.copy()
                if dest[0] <= 1:
                    exit_dir = pygame.Vector2(DIRS["right"])
                elif dest[0] >= GRID_W - 2:
                    exit_dir = pygame.Vector2(DIRS["left"])
                elif dest[1] <= 1:
                    exit_dir = pygame.Vector2(DIRS["down"])
                elif dest[1] >= GRID_H - 2:
                    exit_dir = pygame.Vector2(DIRS["up"])
                if exit_dir.length_squared() == 0:
                    exit_dir = pygame.Vector2(DIRS["right"])
                self.player.pos = target + exit_dir * TILE * 0.55
                self.player.direction = exit_dir.copy()
                self.player.queued = exit_dir.copy()
                self.player.portal_cooldown = 0.65
                self.player.dash_timer = max(self.player.dash_timer, 0.15)
                self.player.last_safe = self.player.pos.copy()
                self.add_pop(self.player.pos, "WARP", PURPLE)
                self.sound.play("dash")

    def handle_traps(self, cell):
        if cell in self.maze.traps and self.player.dash_timer <= 0:
            self.lose_life()

    def check_win(self):
        definition = self.maze.definition
        cell = world_to_grid(self.player.pos)
        progress = self.maze.dot_progress()
        won = False
        if definition.win_type == "dots":
            won = not self.maze.dots
        elif definition.win_type in ("crystal_gate", "cores_exit", "warden_gate"):
            won = self.maze.exit_cell == cell and self.maze.is_exit_open()
        if not won and definition.dot_quota < 1 and progress >= definition.dot_quota and not self.maze.exit_cell:
            won = True

        if won:
            bonus = int(max(0, 3000 - self.global_timer * 8))
            self.add_score(1000 + bonus)
            self.save_high_score()
            self.sound.play("win")
            if self.selected_level < len(LEVELS) - 1:
                self.selected_level += 1
                self.status = "Level clear. Next circuit unlocked."
                self.status_timer = 2
                self.start_level(self.selected_level, reset_score=False)
            else:
                self.state = VICTORY
                self.sound.stop_music()

    def title_buttons(self):
        return {
            "play": pygame.Rect(330, 276, 300, 50),
            "guide": pygame.Rect(330, 342, 300, 50),
            "settings": pygame.Rect(330, 408, 300, 50),
            "quit": pygame.Rect(330, 474, 300, 50),
        }

    def level_cards(self):
        cards = []
        for row in range(2):
            for col in range(2):
                cards.append(pygame.Rect(86 + col * 420, 178 + row * 204, 360, 158))
        return cards

    def pause_buttons(self):
        return {
            "resume": pygame.Rect(330, 260, 300, 50),
            "settings": pygame.Rect(330, 326, 300, 50),
            "menu": pygame.Rect(330, 392, 300, 50),
        }

    def draw_background(self):
        self.screen.fill(BLACK)
        t = pygame.time.get_ticks()
        for y in range(0, SCREEN_HEIGHT, 3):
            shade = 14 + int(20 * y / SCREEN_HEIGHT)
            pygame.draw.line(self.screen, (6, 9, shade), (0, y), (SCREEN_WIDTH, y))
        for x in range(-120, SCREEN_WIDTH, 96):
            color = (18, 35, 70)
            pygame.draw.line(self.screen, color, (x + (t // 40) % 96, 0), (x + 260 + (t // 40) % 96, SCREEN_HEIGHT), 1)
        for y in range(80, SCREEN_HEIGHT, 96):
            pygame.draw.line(self.screen, (14, 38, 72), (0, y), (SCREEN_WIDTH, y + 28), 1)

    def draw_header(self):
        definition = LEVELS[self.selected_level]
        accent, second = definition.theme
        pygame.draw.rect(self.screen, (10, 14, 28), (0, 0, SCREEN_WIDTH, 94))
        pygame.draw.line(self.screen, accent, (0, 93), (SCREEN_WIDTH, 93), 2)
        draw_text(self.screen, self.fonts.medium, definition.name, accent, topleft=(38, 18))
        draw_text(self.screen, self.fonts.tiny, definition.subtitle, MUTED, topleft=(40, 58))
        draw_text(self.screen, self.fonts.small, f"Score {self.score}", WHITE, topleft=(575, 18))
        draw_text(self.screen, self.fonts.small, f"Best {self.high_score}", MUTED, topleft=(575, 52))
        draw_text(self.screen, self.fonts.small, f"Lives {self.lives}", YELLOW, topleft=(760, 18))
        dash = int(max(0, self.player.dash_cooldown) * 10) / 10
        draw_text(self.screen, self.fonts.tiny, f"Dash {'READY' if dash <= 0 else dash}", second, topleft=(760, 54))

    def draw_title(self):
        self.draw_background()
        draw_text(self.screen, self.fonts.hero, "CHOMP", YELLOW, center=(SCREEN_WIDTH // 2, 128))
        draw_text(self.screen, self.fonts.medium, "大口吃", CYAN, center=(SCREEN_WIDTH // 2, 188))
        draw_text(self.screen, self.fonts.cn, "大口吃不只是吃豆：水晶、核心、传送门、Boss、冲刺和动态目标都会出现。", MUTED, center=(SCREEN_WIDTH // 2, 232))
        labels = [("play", "开始游戏"), ("guide", "游戏说明"), ("settings", "设置"), ("quit", "退出")]
        for key, label in labels:
            self.button(label, self.title_buttons()[key], CYAN)
        draw_text(self.screen, self.fonts.tiny, "Windows / Mac: python main.py    Windows package: build_windows.bat", MUTED, center=(SCREEN_WIDTH // 2, 660))

    def draw_level_select(self):
        self.draw_background()
        self.button("返回", pygame.Rect(40, 34, 120, 42), CYAN)
        draw_text(self.screen, self.fonts.big, "选择关卡", YELLOW, center=(SCREEN_WIDTH // 2, 78))
        for i, (definition, rect) in enumerate(zip(LEVELS, self.level_cards())):
            accent, second = definition.theme
            hover = rect.collidepoint(pygame.mouse.get_pos())
            pygame.draw.rect(self.screen, (20, 27, 52) if hover else (14, 20, 38), rect, border_radius=10)
            pygame.draw.rect(self.screen, accent, rect, 2, border_radius=10)
            draw_text(self.screen, self.fonts.medium, definition.name, accent, topleft=(rect.x + 22, rect.y + 20))
            draw_text(self.screen, self.fonts.tiny, definition.subtitle, MUTED, topleft=(rect.x + 24, rect.y + 60))
            draw_text(self.screen, self.fonts.cn, definition.objective, WHITE, topleft=(rect.x + 24, rect.y + 94))
            draw_text(self.screen, self.fonts.tiny, f"Press {i + 1}", second, topleft=(rect.right - 92, rect.bottom - 34))

    def draw_settings(self):
        self.draw_background()
        self.button("返回", pygame.Rect(40, 34, 120, 42), CYAN)
        draw_text(self.screen, self.fonts.big, "Settings", YELLOW, center=(SCREEN_WIDTH // 2, 118))

        panel = pygame.Rect(220, 210, 520, 330)
        pygame.draw.rect(self.screen, PANEL, panel, border_radius=12)
        pygame.draw.rect(self.screen, CYAN, panel, 2, border_radius=12)

        draw_text(self.screen, self.fonts.medium, "Volume", WHITE, center=(SCREEN_WIDTH // 2, 246))
        self.button("<", pygame.Rect(265, 254, 55, 44), YELLOW)
        self.button(">", pygame.Rect(640, 254, 55, 44), YELLOW)
        bar = pygame.Rect(350, 267, 260, 18)
        pygame.draw.rect(self.screen, (40, 48, 74), bar, border_radius=8)
        fill = pygame.Rect(bar.x, bar.y, int(bar.w * self.sound.volume / 100), bar.h)
        pygame.draw.rect(self.screen, YELLOW, fill, border_radius=8)
        draw_text(self.screen, self.fonts.small, f"{self.sound.volume}%", WHITE, center=(SCREEN_WIDTH // 2, 310))

        draw_text(self.screen, self.fonts.medium, "Music", WHITE, center=(SCREEN_WIDTH // 2, 350))
        self.button("<", pygame.Rect(258, 358, 55, 44), CYAN)
        self.button(">", pygame.Rect(647, 358, 55, 44), CYAN)
        name_rect = pygame.Rect(330, 362, 300, 36)
        pygame.draw.rect(self.screen, (9, 13, 25), name_rect, border_radius=6)
        pygame.draw.rect(self.screen, CYAN, name_rect, 1, border_radius=6)
        draw_text(self.screen, self.fonts.cn, self.sound.current_music_name(), CYAN, center=name_rect.center)

        self.button("静音" if not self.sound.muted else "取消静音", pygame.Rect(385, 454, 190, 44), GREEN)

    def draw_guide(self):
        self.draw_background()
        draw_text(self.screen, self.fonts.big, "Game Guide", YELLOW, center=(SCREEN_WIDTH // 2, 74))
        panel = pygame.Rect(90, 125, 780, 470)
        pygame.draw.rect(self.screen, PANEL, panel, border_radius=12)
        pygame.draw.rect(self.screen, CYAN, panel, 2, border_radius=12)
        lines = [
            "方向键 / WASD：移动。Space：冲刺，冲刺时可以穿过危险瞬间，但有冷却。",
            "能量豆：短时间反击幽灵，连续吃幽灵会提高分数。",
            "护盾：抵挡一次幽灵或陷阱伤害。",
            "传送门：连接远端路线，可用于甩开追击。",
            "地图1：传统清豆。地图2：收集水晶开门。",
            "地图3：偷取核心并撤离，陷阱和速度压力更高。",
            "地图4：Boss巡逻场，达成目标后从出口逃离。",
            "设置里可切换玩家音乐 / 枫叶人音乐。默认是玩家音乐。",
            "点击任意位置返回主菜单。",
        ]
        y = 165
        for line in lines:
            draw_text(self.screen, self.fonts.cn, line, WHITE, topleft=(128, y))
            y += 44

    def draw_game(self):
        self.draw_background()
        self.draw_header()
        definition = self.maze.definition
        accent, second = definition.theme
        self.maze.draw(self.screen, pygame.time.get_ticks(), accent)
        for ghost in self.ghosts:
            ghost.draw(self.screen, self.player.power_timer > 0)
        self.player.draw(self.screen)
        for p in self.particles:
            p.draw(self.screen, self.fonts.tiny)

        progress = int(self.maze.dot_progress() * 100)
        info_y = BOARD_Y + BOARD_H + 18
        items = []
        if definition.win_type == "dots":
            items.append(f"Dots {progress}%")
        if definition.win_type in ("crystal_gate", "warden_gate"):
            total = len(definition.crystals)
            items.append(f"Crystals {total - len(self.maze.crystals)}/{total}")
        if definition.win_type == "cores_exit":
            total = len(definition.cores)
            items.append(f"Cores {total - len(self.maze.cores)}/{total}")
        if self.maze.exit_cell:
            items.append("Gate OPEN" if self.maze.is_exit_open() else "Gate LOCKED")
        if self.player.power_timer > 0:
            items.append(f"Power {self.player.power_timer:.1f}s")
        draw_text(self.screen, self.fonts.small, "   |   ".join(items), second, topleft=(42, info_y))
        if self.status_timer > 0:
            draw_text(self.screen, self.fonts.cn, self.status, WHITE, center=(SCREEN_WIDTH // 2, 680))

    def draw_pause(self):
        self.draw_game()
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 155))
        self.screen.blit(overlay, (0, 0))
        draw_text(self.screen, self.fonts.big, "PAUSED", YELLOW, center=(SCREEN_WIDTH // 2, 190))
        labels = {"resume": "继续", "settings": "设置", "menu": "主菜单"}
        for key, label in labels.items():
            self.button(label, self.pause_buttons()[key], CYAN)

    def draw_end(self, victory=False):
        self.draw_background()
        title = "CHOMP COMPLETE" if victory else "CHOMP ENDED"
        color = GREEN if victory else RED
        draw_text(self.screen, self.fonts.big, title, color, center=(SCREEN_WIDTH // 2, 190))
        draw_text(self.screen, self.fonts.medium, f"Score: {self.score}", WHITE, center=(SCREEN_WIDTH // 2, 280))
        draw_text(self.screen, self.fonts.medium, f"Best: {self.high_score}", YELLOW, center=(SCREEN_WIDTH // 2, 330))
        draw_text(self.screen, self.fonts.cn, "点击或按空格返回主菜单", MUTED, center=(SCREEN_WIDTH // 2, 430))

    def draw(self):
        if self.state == TITLE:
            self.draw_title()
        elif self.state == LEVEL_SELECT:
            self.draw_level_select()
        elif self.state == PLAYING:
            self.draw_game()
        elif self.state == PAUSED:
            self.draw_pause()
        elif self.state == SETTINGS:
            self.draw_settings()
        elif self.state == GUIDE:
            self.draw_guide()
        elif self.state == GAME_OVER:
            self.draw_end(False)
        elif self.state == VICTORY:
            self.draw_end(True)
        pygame.display.flip()

    def run(self):
        running = True
        while running:
            dt = self.clock.tick(FPS) / 1000
            running = self.handle_events()
            self.update(dt)
            self.draw()
        pygame.quit()


if __name__ == "__main__":
    Game().run()
